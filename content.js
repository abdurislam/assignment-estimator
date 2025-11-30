/**
 * Content Script for Canvas Assignment Extraction
 * Runs on Canvas LMS pages to extract assignment data
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const PAGE_TYPES = {
    DASHBOARD: 'dashboard',
    ASSIGNMENT_DETAIL: 'assignment_detail',
    ASSIGNMENTS_LIST: 'assignments_list',
    MODULES: 'modules',
    SYLLABUS: 'syllabus',
    COURSE_HOME: 'course_home',
    OTHER: 'other'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseDueDate(dateText) {
    if (!dateText || dateText.toLowerCase().includes('no due date')) return null;

    let cleaned = dateText.replace(/^due\s+/i, '').trim();
    cleaned = cleaned.replace(/\s+at\s+\d+:\d+\s*[ap]m/i, '');
    cleaned = cleaned.replace(/\s+\d+:\d+\s*[ap]m/i, '');

    if (cleaned.match(/^\/\d{1,2}$/) || /200[01]|1999/.test(cleaned)) return null;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const formats = [
        // Short month: "Dec 2"
        () => {
            const m = cleaned.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
            if (m) {
                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthIdx = months.indexOf(m[1].toLowerCase());
                let year = m[3] ? parseInt(m[3]) : currentYear;
                if (!m[3] && monthIdx < currentMonth) year = currentYear + 1;
                return new Date(`${m[1]} ${m[2]}, ${year}`);
            }
            return null;
        },
        // Full month: "December 2"
        () => {
            const m = cleaned.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
            return m ? new Date(`${m[1]} ${m[2]}, ${m[3] || currentYear}`) : null;
        },
        () => new Date(cleaned),
        () => new Date(`${cleaned}, ${currentYear}`),
        // MM/DD format
        () => {
            const m = cleaned.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
            if (m) {
                const year = m[3] || currentYear;
                if (year >= currentYear && year <= currentYear + 1) {
                    return new Date(`${m[1]}/${m[2]}/${year}`);
                }
            }
            return null;
        }
    ];

    for (const fn of formats) {
        try {
            const date = fn();
            if (date && !isNaN(date.getTime())) {
                const now = new Date();
                const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                const twoYearsOut = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
                if (date >= yearAgo && date <= twoYearsOut) {
                    return date.toLocaleDateString();
                }
            }
        } catch (e) { /* continue */ }
    }

    return null;
}

function parsePoints(text) {
    if (!text) return null;
    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
}

function cleanTitle(title) {
    if (!title) return '';
    let t = title;
    t = t.replace(/\s+[A-Z]{2,8}[_-][A-Z0-9-]+/gi, '');
    t = t.replace(/\s*\d+\s+out\s+of\s+\d+/gi, '');
    t = t.replace(/\s*"[^"]*"/g, '');
    t = t.replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2}(?:,?\s*\d{4})?$/i, '');
    return t.trim();
}

function waitForElement(selector, timeout = 5000) {
    return new Promise(resolve => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
}

function deduplicateAssignments(arr) {
    const seen = new Set();
    return arr.filter(a => {
        const key = a.url || a.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ============================================================================
// CANVAS EXTRACTOR CLASS
// ============================================================================

class CanvasExtractor {
    constructor() {
        this.pageType = this.detectPageType();
        console.log(`[Canvas] Page type: ${this.pageType}`);
    }

    detectPageType() {
        const path = window.location.pathname;
        const url = window.location.href;

        if (path.includes('/assignments/') && path.match(/\/assignments\/\d+/)) return PAGE_TYPES.ASSIGNMENT_DETAIL;
        if (path.includes('/assignments')) return PAGE_TYPES.ASSIGNMENTS_LIST;
        if (path.includes('/modules')) return PAGE_TYPES.MODULES;
        if (path.includes('/syllabus')) return PAGE_TYPES.SYLLABUS;
        if (path === '/' || path.includes('/dashboard') || url.includes('dashboard')) return PAGE_TYPES.DASHBOARD;
        if (path.match(/\/courses\/\d+$/)) return PAGE_TYPES.COURSE_HOME;
        return PAGE_TYPES.OTHER;
    }

    async extract() {
        console.log('[Canvas] Starting extraction');
        await waitForElement('body', 5000);

        let assignments = [];

        switch (this.pageType) {
            case PAGE_TYPES.DASHBOARD:
                assignments = this.extractDashboard();
                break;
            case PAGE_TYPES.ASSIGNMENT_DETAIL:
                assignments = this.extractDetail();
                break;
            case PAGE_TYPES.ASSIGNMENTS_LIST:
                assignments = this.extractList();
                break;
            case PAGE_TYPES.MODULES:
                assignments = this.extractModules();
                break;
            case PAGE_TYPES.SYLLABUS:
                assignments = this.extractSyllabus();
                break;
            default:
                assignments = this.extractFallback();
        }

        assignments = deduplicateAssignments(assignments || []);
        console.log(`[Canvas] Found ${assignments.length} assignments`);

        if (assignments.length === 0) {
            throw new Error(`No assignments found on this ${this.pageType} page`);
        }

        return assignments;
    }

    extractDashboard() {
        const assignments = [];
        const links = document.querySelectorAll('a[href*="/assignments/"]');

        links.forEach(link => {
            if (!link.href.includes('/assignments/')) return;
            const data = this.extractFromLink(link);
            if (data) {
                data.source = 'dashboard';
                assignments.push(data);
            }
        });

        return assignments;
    }

    extractDetail() {
        const titleEl = document.querySelector('.assignment-title, h1.title, [data-testid="assignment-name"]');
        if (!titleEl) return [];

        const descEl = document.querySelector('.assignment_description, .description');
        const pointsEl = document.querySelector('.assignment-points-possible, .points');
        const dueEl = document.querySelector('.assignment-due-date, .due-date');

        return [{
            title: titleEl.textContent.trim(),
            url: window.location.href,
            dueDate: dueEl ? parseDueDate(dueEl.textContent.trim()) : null,
            points: pointsEl ? parsePoints(pointsEl.textContent.trim()) : null,
            type: 'assignment',
            description: descEl ? descEl.textContent.trim().substring(0, 500) : null,
            course: this.getCourse(),
            source: 'detail'
        }];
    }

    extractList() {
        const assignments = [];
        const links = document.querySelectorAll('a[href*="/assignments/"]');

        links.forEach(link => {
            if (!link.href.match(/\/assignments\/\d+/)) return;
            const parent = link.closest('tr, li, .assignment, .ig-row');
            const data = this.extractFromElement(parent || link, link);
            if (data) {
                data.source = 'list';
                assignments.push(data);
            }
        });

        return assignments;
    }

    extractModules() {
        const assignments = [];
        const items = document.querySelectorAll('.context_module_item[data-module-item-type="Assignment"]');

        items.forEach(item => {
            const titleEl = item.querySelector('.ig-title a, .item_name a');
            const dueEl = item.querySelector('.due_date_display');
            if (titleEl) {
                assignments.push({
                    title: titleEl.textContent.trim(),
                    url: titleEl.href,
                    dueDate: dueEl ? parseDueDate(dueEl.textContent.trim()) : null,
                    points: null,
                    type: 'assignment',
                    description: null,
                    course: this.getCourse(),
                    source: 'modules'
                });
            }
        });

        return assignments;
    }

    extractSyllabus() {
        const assignments = [];
        const items = document.querySelectorAll('.syllabus_assignment');

        items.forEach(item => {
            const titleEl = item.querySelector('.assignment_title a');
            const dueEl = item.querySelector('.syllabus_assignment_date');
            if (titleEl) {
                assignments.push({
                    title: titleEl.textContent.trim(),
                    url: titleEl.href,
                    dueDate: dueEl ? parseDueDate(dueEl.textContent.trim()) : null,
                    points: null,
                    type: 'assignment',
                    description: null,
                    course: this.getCourse(),
                    source: 'syllabus'
                });
            }
        });

        return assignments;
    }

    extractFallback() {
        let assignments = this.extractList();
        if (assignments.length === 0) assignments = this.extractModules();
        if (assignments.length === 0) assignments = this.extractSyllabus();
        if (assignments.length === 0) assignments = this.extractDashboard();
        return assignments;
    }

    extractFromLink(link) {
        const parent = link.closest('li, tr, div[class], [role="listitem"]');
        return this.extractFromElement(parent || link, link);
    }

    extractFromElement(container, titleLink) {
        if (!titleLink) return null;

        let dueDate = null;
        let points = null;
        let course = 'Unknown Course';

        // Extract due date
        const dateSelectors = ['.due-date', '.date', '[class*="due"]', '[class*="date"]', 'time'];
        for (const sel of dateSelectors) {
            const el = container?.querySelector?.(sel);
            if (el) {
                dueDate = parseDueDate(el.textContent.trim());
                if (dueDate) break;
            }
        }

        // Try date from title
        if (!dueDate) {
            const match = titleLink.textContent.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
            if (match) dueDate = parseDueDate(match[0]);
        }

        // Extract points
        for (const sel of ['.points', '[class*="points"]', '[class*="pts"]']) {
            const el = container?.querySelector?.(sel);
            if (el) {
                points = parsePoints(el.textContent.trim());
                if (points) break;
            }
        }

        // Extract course
        for (const sel of ['.course-name', '.context-name', '[class*="course"]']) {
            const el = container?.querySelector?.(sel);
            if (el?.textContent?.trim() && !el.textContent.includes('GPA')) {
                course = el.textContent.trim();
                break;
            }
        }

        return {
            title: cleanTitle(titleLink.textContent.trim()),
            url: titleLink.href,
            dueDate,
            points,
            type: 'assignment',
            description: null,
            course
        };
    }

    getCourse() {
        const selectors = ['#course_name', '.course-title', '.course-name', '[data-testid="course-name"]'];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el?.textContent?.trim() && !el.textContent.includes('GPA')) {
                return el.textContent.trim();
            }
        }
        const match = window.location.pathname.match(/\/courses\/(\d+)/);
        return match ? `Course ${match[1]}` : 'Unknown Course';
    }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

const extractor = new CanvasExtractor();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAssignments') {
        extractor.extract()
            .then(assignments => sendResponse({ success: true, assignments, pageType: extractor.pageType }))
            .catch(error => sendResponse({ success: false, error: error.message, pageType: extractor.pageType }));
        return true;
    }
});

console.log('[Canvas] Content script loaded');
