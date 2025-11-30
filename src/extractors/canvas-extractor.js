/**
 * Canvas Assignment Extractor
 * Base extraction logic for Canvas LMS pages
 */

import { PAGE_TYPES } from '../utils/constants.js';
import { parseDueDate, parsePoints, waitForElement, deduplicateAssignments, cleanTitle } from '../utils/helpers.js';

export class CanvasExtractor {
    constructor() {
        this.pageType = this.detectPageType();
    }

    /**
     * Detect the current Canvas page type
     * @returns {string} Page type constant
     */
    detectPageType() {
        const path = window.location.pathname;
        const url = window.location.href;
        
        if (path.includes('/assignments/') && path.match(/\/assignments\/\d+/)) {
            return PAGE_TYPES.ASSIGNMENT_DETAIL;
        } else if (path.includes('/assignments')) {
            return PAGE_TYPES.ASSIGNMENTS_LIST;
        } else if (path.includes('/modules')) {
            return PAGE_TYPES.MODULES;
        } else if (path.includes('/syllabus')) {
            return PAGE_TYPES.SYLLABUS;
        } else if (path === '/' || path.includes('/dashboard') || url.includes('dashboard')) {
            return PAGE_TYPES.DASHBOARD;
        } else if (path.match(/\/courses\/\d+$/)) {
            return PAGE_TYPES.COURSE_HOME;
        }
        return PAGE_TYPES.OTHER;
    }

    /**
     * Extract assignments from the current page
     * @returns {Promise<Array>} Array of assignment objects
     */
    async extractAssignments() {
        console.log(`[CanvasExtractor] Extracting from ${this.pageType} page`);
        
        await waitForElement('body', 5000);
        
        let assignments = [];

        switch (this.pageType) {
            case PAGE_TYPES.DASHBOARD:
                assignments = await this.extractFromDashboard();
                break;
            case PAGE_TYPES.ASSIGNMENT_DETAIL:
                assignments = await this.extractFromAssignmentDetail();
                break;
            case PAGE_TYPES.ASSIGNMENTS_LIST:
                assignments = this.extractFromAssignmentList();
                break;
            case PAGE_TYPES.MODULES:
                assignments = this.extractFromModules();
                break;
            case PAGE_TYPES.SYLLABUS:
                assignments = this.extractFromSyllabus();
                break;
            case PAGE_TYPES.COURSE_HOME:
                assignments = await this.extractFromCourseHome();
                break;
            default:
                assignments = await this.extractFallback();
        }

        if (!Array.isArray(assignments)) assignments = [];
        
        const deduplicated = deduplicateAssignments(assignments);
        
        if (deduplicated.length === 0) {
            throw new Error(`No assignments found on this ${this.pageType} page.`);
        }

        console.log(`[CanvasExtractor] Found ${deduplicated.length} assignments`);
        return deduplicated;
    }

    /**
     * Extract from dashboard page
     */
    async extractFromDashboard() {
        const assignments = [];
        
        // Find all assignment links
        const assignmentLinks = document.querySelectorAll('a[href*="/assignments/"]');
        
        assignmentLinks.forEach(link => {
            if (!link.href.includes('/assignments/')) return;
            
            const assignment = this.extractFromLink(link);
            if (assignment) {
                assignment.source = 'dashboard';
                assignments.push(assignment);
            }
        });

        // Also check todo items
        const todoSelectors = [
            '.Sidebar__TodoListItem',
            '.todo-list .todo-item',
            '[data-testid="todo-item"]'
        ];

        for (const selector of todoSelectors) {
            const items = document.querySelectorAll(selector);
            items.forEach(item => {
                const titleEl = item.querySelector('a[href*="/assignments/"]');
                if (titleEl) {
                    const assignment = this.extractFromElement(item, titleEl);
                    if (assignment) {
                        assignment.source = 'todo';
                        assignments.push(assignment);
                    }
                }
            });
        }

        return assignments;
    }

    /**
     * Extract from assignment detail page
     */
    async extractFromAssignmentDetail() {
        const titleEl = document.querySelector('.assignment-title, h1.title, [data-testid="assignment-name"]');
        const descEl = document.querySelector('.assignment_description, .description');
        const pointsEl = document.querySelector('.assignment-points-possible, .points');
        const dueEl = document.querySelector('.assignment-due-date, .due-date');

        if (!titleEl) return [];

        return [{
            title: titleEl.textContent.trim(),
            url: window.location.href,
            dueDate: dueEl ? parseDueDate(dueEl.textContent.trim()) : null,
            points: pointsEl ? parsePoints(pointsEl.textContent.trim()) : null,
            type: 'assignment',
            description: descEl ? descEl.textContent.trim().substring(0, 500) : null,
            course: this.getCourseFromPage(),
            source: 'assignment_detail'
        }];
    }

    /**
     * Extract from assignments list page
     */
    extractFromAssignmentList() {
        const assignments = [];
        
        const links = document.querySelectorAll('a[href*="/assignments/"]');
        links.forEach(link => {
            if (!link.href.match(/\/assignments\/\d+/)) return;
            
            const parent = link.closest('tr, li, .assignment, .ig-row');
            const assignment = this.extractFromElement(parent || link, link);
            if (assignment) {
                assignment.source = 'assignments_list';
                assignments.push(assignment);
            }
        });

        return assignments;
    }

    /**
     * Extract from modules page
     */
    extractFromModules() {
        const assignments = [];
        
        const moduleItems = document.querySelectorAll('.context_module_item[data-module-item-type="Assignment"]');
        moduleItems.forEach(item => {
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
                    course: this.getCourseFromPage(),
                    source: 'modules'
                });
            }
        });

        return assignments;
    }

    /**
     * Extract from syllabus page
     */
    extractFromSyllabus() {
        const assignments = [];
        
        const syllabusItems = document.querySelectorAll('.syllabus_assignment');
        syllabusItems.forEach(item => {
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
                    course: this.getCourseFromPage(),
                    source: 'syllabus'
                });
            }
        });

        return assignments;
    }

    /**
     * Extract from course home page
     */
    async extractFromCourseHome() {
        const assignments = [];
        
        const cards = document.querySelectorAll('a[href*="assignment"]');
        cards.forEach(card => {
            assignments.push({
                title: card.textContent.trim(),
                url: card.href,
                dueDate: null,
                points: null,
                type: 'assignment',
                description: null,
                course: this.getCourseFromPage(),
                source: 'course_home'
            });
        });

        return assignments;
    }

    /**
     * Fallback extraction method
     */
    async extractFallback() {
        let assignments = this.extractFromAssignmentList();
        if (assignments.length === 0) assignments = this.extractFromModules();
        if (assignments.length === 0) assignments = this.extractFromSyllabus();
        if (assignments.length === 0) assignments = await this.extractFromDashboard();
        return assignments;
    }

    /**
     * Extract assignment from a link element with context
     */
    extractFromLink(link) {
        const parent = link.closest('li, tr, div[class], [role="listitem"]');
        return this.extractFromElement(parent || link, link);
    }

    /**
     * Extract assignment from an element
     */
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

        // Try to extract date from title if not found
        if (!dueDate) {
            const titleText = titleLink.textContent;
            const match = titleText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
            if (match) {
                dueDate = parseDueDate(match[0]);
            }
        }

        // Extract points
        const pointsSelectors = ['.points', '[class*="points"]', '[class*="pts"]'];
        for (const sel of pointsSelectors) {
            const el = container?.querySelector?.(sel);
            if (el) {
                points = parsePoints(el.textContent.trim());
                if (points) break;
            }
        }

        // Extract course
        const courseSelectors = ['.course-name', '.context-name', '[class*="course"]'];
        for (const sel of courseSelectors) {
            const el = container?.querySelector?.(sel);
            if (el && el.textContent.trim() && !el.textContent.includes('GPA')) {
                course = el.textContent.trim();
                break;
            }
        }

        // Clean title (remove date if it was appended)
        let title = titleLink.textContent.trim();
        title = cleanTitle(title);

        return {
            title,
            url: titleLink.href,
            dueDate,
            points,
            type: 'assignment',
            description: null,
            course
        };
    }

    /**
     * Get course name from page
     */
    getCourseFromPage() {
        const selectors = [
            '#course_name',
            '.course-title',
            '.course-name',
            '[data-testid="course-name"]'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim() && !el.textContent.includes('GPA')) {
                return el.textContent.trim();
            }
        }

        // Try from URL
        const match = window.location.pathname.match(/\/courses\/(\d+)/);
        if (match) {
            return `Course ${match[1]}`;
        }

        return 'Unknown Course';
    }
}
