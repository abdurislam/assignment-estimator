/**
 * Popup Script for Assignment Estimator
 * Handles the extension popup UI
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const PAGE_TYPE_LABELS = {
    dashboard: 'Canvas Dashboard',
    assignment_detail: 'Assignment Page',
    assignments_list: 'Assignments List',
    modules: 'Course Modules',
    syllabus: 'Course Syllabus',
    course_home: 'Course Home',
    other: 'Canvas Page'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function cleanTitle(title) {
    if (!title) return '';
    let t = title;
    t = t.replace(/\s+[A-Z]{2,8}[_-][A-Z0-9-]+/gi, '');
    t = t.replace(/\s*\d+\s+out\s+of\s+\d+/gi, '');
    t = t.replace(/\s*"[^"]*"/g, '');
    return t.trim();
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

function showStatus(element, type, message, autoHide = 0) {
    element.className = `status ${type}`;
    element.textContent = message;
    element.style.display = 'block';
    if (autoHide > 0) {
        setTimeout(() => { element.style.display = 'none'; }, autoHide);
    }
}

// ============================================================================
// WEEKLY GROUPING
// ============================================================================

function groupByWeek(estimates) {
    const weeks = {};
    const now = new Date();
    const currentWeekStart = getWeekStart(now);

    estimates.forEach(assignment => {
        const isCompleted = /\d+\s+out\s+of\s+\d+/i.test(assignment.title);
        let weekKey, weekLabel, weekStart;

        if (isCompleted) {
            weekKey = 'completed';
            weekLabel = '✅ Completed';
            weekStart = null;
        } else if (!assignment.dueDate) {
            weekKey = 'no-date';
            weekLabel = '📋 No Due Date';
            weekStart = null;
        } else {
            const dueDate = new Date(assignment.dueDate);
            weekStart = getWeekStart(dueDate);
            weekKey = weekStart.toISOString().split('T')[0];
            const diffDays = Math.floor((weekStart - currentWeekStart) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) weekLabel = '📍 This Week';
            else if (diffDays === 7) weekLabel = '📅 Next Week';
            else if (diffDays < 0) weekLabel = '⏰ Overdue';
            else weekLabel = `Week ${Math.ceil(diffDays / 7) + 1} (${formatDate(weekStart)})`;
        }

        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                label: weekLabel,
                weekStart,
                assignments: [],
                totalHours: 0,
                isCurrentWeek: weekKey === currentWeekStart.toISOString().split('T')[0],
                isCompleted: weekKey === 'completed',
                isPast: weekStart && weekStart < currentWeekStart
            };
        }

        const hours = typeof assignment.estimate === 'number' ? assignment.estimate : 0;
        weeks[weekKey].assignments.push(assignment);
        weeks[weekKey].totalHours += hours;
    });

    return Object.entries(weeks).sort((a, b) => {
        if (a[0] === 'completed') return 1;
        if (b[0] === 'completed') return -1;
        if (a[0] === 'no-date') return 1;
        if (b[0] === 'no-date') return -1;
        return new Date(a[0]) - new Date(b[0]);
    });
}

function calculateStats(estimates) {
    let totalHours = 0, upcomingCount = 0, completedCount = 0;

    estimates.forEach(a => {
        const hours = typeof a.estimate === 'number' ? a.estimate : 0;
        totalHours += hours;
        if (/\d+\s+out\s+of\s+\d+/i.test(a.title) || a.dueDate === null) {
            completedCount++;
        } else {
            upcomingCount++;
        }
    });

    return { totalHours, upcomingCount, completedCount };
}

// ============================================================================
// RENDERERS
// ============================================================================

function renderWeeklyView(container, weeklyData) {
    container.innerHTML = '';
    const maxHours = Math.max(...weeklyData.map(([_, w]) => w.totalHours), 10);

    weeklyData.forEach(([_, week]) => {
        const section = document.createElement('div');
        section.className = 'week-section';

        let headerClass = 'week-header';
        if (week.isCurrentWeek) headerClass += ' current-week';
        else if (week.isPast || week.isCompleted) headerClass += ' past-week';

        let barClass = 'week-bar-fill';
        if (week.totalHours > 15) barClass += ' heavy';
        else if (week.totalHours > 8) barClass += ' moderate';

        const barWidth = (week.totalHours / maxHours) * 100;

        section.innerHTML = `
            <div class="${headerClass}">
                <span class="week-title">${week.label}</span>
                <span class="week-stats">${week.assignments.length} items • ${week.totalHours.toFixed(1)}h</span>
            </div>
            <div class="week-bar">
                <div class="${barClass}" style="width: ${barWidth}%"></div>
            </div>
            <div class="week-assignments">
                ${week.assignments.map(a => {
                    const title = cleanTitle(a.title);
                    const hours = typeof a.estimate === 'number' ? a.estimate : 0;
                    return `<div class="week-assignment-item">
                        <span class="week-assignment-title" title="${title}">${title}</span>
                        <span class="week-assignment-hours">${hours}h</span>
                    </div>`;
                }).join('')}
            </div>
        `;
        container.appendChild(section);
    });
}

function renderChartView(container, weeklyData) {
    container.innerHTML = '';
    const upcoming = weeklyData.filter(([k]) => k !== 'completed' && k !== 'no-date').slice(0, 6);

    if (upcoming.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No upcoming assignments</div>';
        return;
    }

    const maxHours = Math.max(...upcoming.map(([_, w]) => w.totalHours), 10);

    upcoming.forEach(([_, week], i) => {
        const barHeight = (week.totalHours / maxHours) * 80;
        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar-container';
        barContainer.innerHTML = `
            <div class="chart-bar-value">${week.totalHours.toFixed(1)}h</div>
            <div class="chart-bar ${week.isCurrentWeek ? 'current' : ''}" style="height: ${barHeight}px"></div>
            <div class="chart-bar-label">${week.isCurrentWeek ? 'This' : 'Wk ' + (i + 1)}</div>
        `;
        container.appendChild(barContainer);
    });
}

function renderAllAssignments(container, estimates, pageType) {
    container.innerHTML = '';

    estimates.forEach(assignment => {
        const item = document.createElement('div');
        item.className = 'assignment-item';
        const title = cleanTitle(assignment.title);

        let dueDateDisplay = '', dueDateClass = 'assignment-due';
        if (assignment.dueDate) {
            const dueDate = new Date(assignment.dueDate);
            const daysUntil = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil < 0) {
                dueDateDisplay = `⚠️ Overdue (${assignment.dueDate})`;
                dueDateClass += ' urgent';
            } else if (daysUntil <= 2) {
                dueDateDisplay = `🔥 Due ${assignment.dueDate}`;
                dueDateClass += ' urgent';
            } else {
                dueDateDisplay = `📅 Due ${assignment.dueDate}`;
            }
        } else if (/\d+\s+out\s+of\s+\d+/i.test(assignment.title)) {
            dueDateDisplay = '✅ Completed';
            dueDateClass += ' completed';
        } else {
            dueDateDisplay = '📋 No due date';
        }

        const courseInfo = assignment.course && pageType === 'dashboard'
            ? `<div class="assignment-course">📚 ${assignment.course}</div>` : '';

        item.innerHTML = `
            ${courseInfo}
            <div class="assignment-title">${title}</div>
            <div class="assignment-meta">
                <span class="assignment-estimate">⏱️ ${assignment.estimate} ${typeof assignment.estimate === 'number' ? 'hours' : ''}</span>
                <span class="${dueDateClass}">${dueDateDisplay}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// ============================================================================
// MAIN CLASS
// ============================================================================

class AssignmentEstimatorPopup {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.checkCurrentPage();
    }

    initElements() {
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.status = document.getElementById('status');
        this.assignmentsContainer = document.getElementById('assignments-container');
        this.assignmentsList = document.getElementById('assignments-list');
        this.settingsLink = document.getElementById('settings-link');
        this.weeksContainer = document.getElementById('weeks-container');
        this.chartBars = document.getElementById('chart-bars');
        this.tabs = document.querySelectorAll('.tab');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    bindEvents() {
        this.analyzeBtn.addEventListener('click', () => this.analyze());
        this.settingsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }

    switchTab(tabName) {
        this.tabs.forEach(t => t.classList.remove('active'));
        this.tabContents.forEach(tc => tc.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-view`).classList.add('active');
    }

    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('instructure.com') && !tab.url.includes('canvas.com')) {
                showStatus(this.status, 'error', 'Please navigate to a Canvas page first');
                this.analyzeBtn.disabled = true;
                return;
            }

            const pageInfo = this.getPageInfo(tab.url);
            this.analyzeBtn.textContent = pageInfo.buttonText;
            if (pageInfo.hint) showStatus(this.status, 'info', pageInfo.hint);
        } catch (error) {
            console.error('[Popup] Error:', error);
        }
    }

    getPageInfo(url) {
        const path = new URL(url).pathname;
        if (path === '/' || path.includes('/dashboard') || url.includes('dashboard')) {
            return { buttonText: 'Analyze Dashboard Assignments', hint: 'Analyze assignments from your Canvas dashboard' };
        }
        if (path.includes('/assignments/') && path.match(/\/assignments\/\d+/)) {
            return { buttonText: 'Estimate This Assignment', hint: 'Estimate the current assignment' };
        }
        if (path.includes('/assignments')) {
            return { buttonText: 'Analyze Course Assignments', hint: 'Analyze all assignments in this course' };
        }
        if (path.includes('/modules')) {
            return { buttonText: 'Analyze Module Assignments', hint: 'Analyze assignments from course modules' };
        }
        return { buttonText: 'Analyze Canvas Assignments', hint: 'Navigate to assignments or dashboard for best results' };
    }

    async analyze() {
        try {
            showStatus(this.status, 'loading', 'Scanning Canvas page...');
            this.analyzeBtn.disabled = true;

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('instructure.com') && !tab.url.includes('canvas.com')) {
                throw new Error('Please navigate to your Canvas page first');
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAssignments' });
            if (!response.success) throw new Error(response.error || 'Failed to fetch assignments');

            showStatus(this.status, 'loading', `Found ${response.assignments.length} assignments. Analyzing...`);

            const estimates = await this.getEstimates(response.assignments);
            this.displayResults(estimates, response.pageType);
            showStatus(this.status, 'success', `Analysis complete! ${estimates.length} assignments`, 3000);

        } catch (error) {
            console.error('[Popup] Error:', error);
            showStatus(this.status, 'error', error.message);
        } finally {
            this.analyzeBtn.disabled = false;
        }
    }

    async getEstimates(assignments) {
        const estimates = [];
        for (const assignment of assignments) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'estimateTime',
                    assignment
                });
                estimates.push({ ...assignment, estimate: response.estimate || 'Unknown' });
            } catch (error) {
                estimates.push({ ...assignment, estimate: 'Error' });
            }
        }
        return estimates;
    }

    displayResults(estimates, pageType) {
        const stats = calculateStats(estimates);
        document.getElementById('total-hours').textContent = stats.totalHours.toFixed(1);
        document.getElementById('upcoming-count').textContent = stats.upcomingCount;
        document.getElementById('completed-count').textContent = stats.completedCount;

        const weeklyData = groupByWeek(estimates);
        renderWeeklyView(this.weeksContainer, weeklyData);
        renderChartView(this.chartBars, weeklyData);
        renderAllAssignments(this.assignmentsList, estimates, pageType);

        this.assignmentsContainer.style.display = 'block';
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => new AssignmentEstimatorPopup());
