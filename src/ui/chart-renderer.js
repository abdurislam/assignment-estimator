/**
 * Chart Renderer - Renders workload charts
 */

import { cleanTitle } from '../utils/helpers.js';

/**
 * Render weekly view with progress bars
 * @param {HTMLElement} container - Container element
 * @param {Array} weeklyData - Weekly grouped data
 */
export function renderWeeklyView(container, weeklyData) {
    container.innerHTML = '';
    
    const maxHours = Math.max(...weeklyData.map(([_, w]) => w.totalHours), 10);

    weeklyData.forEach(([weekKey, week]) => {
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
                ${week.assignments.map(a => renderWeekAssignment(a)).join('')}
            </div>
        `;

        container.appendChild(section);
    });
}

/**
 * Render a single assignment in weekly view
 */
function renderWeekAssignment(assignment) {
    const title = cleanTitle(assignment.title);
    const hours = typeof assignment.estimate === 'number' ? assignment.estimate : 0;

    return `
        <div class="week-assignment-item">
            <span class="week-assignment-title" title="${title}">${title}</span>
            <span class="week-assignment-hours">${hours}h</span>
        </div>
    `;
}

/**
 * Render bar chart view
 * @param {HTMLElement} container - Container element
 * @param {Array} weeklyData - Weekly grouped data
 */
export function renderChartView(container, weeklyData) {
    container.innerHTML = '';

    // Filter to upcoming weeks only
    const upcomingWeeks = weeklyData
        .filter(([key]) => key !== 'completed' && key !== 'no-date')
        .slice(0, 6);

    if (upcomingWeeks.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No upcoming assignments to display</div>';
        return;
    }

    const maxHours = Math.max(...upcomingWeeks.map(([_, w]) => w.totalHours), 10);

    upcomingWeeks.forEach(([weekKey, week], index) => {
        const barHeight = (week.totalHours / maxHours) * 80;

        const barContainer = document.createElement('div');
        barContainer.className = 'chart-bar-container';

        barContainer.innerHTML = `
            <div class="chart-bar-value">${week.totalHours.toFixed(1)}h</div>
            <div class="chart-bar ${week.isCurrentWeek ? 'current' : ''}" style="height: ${barHeight}px"></div>
            <div class="chart-bar-label">${week.isCurrentWeek ? 'This' : 'Wk ' + (index + 1)}</div>
        `;

        container.appendChild(barContainer);
    });
}

/**
 * Render all assignments list
 * @param {HTMLElement} container - Container element
 * @param {Array} estimates - All estimates
 * @param {string} pageType - Current page type
 */
export function renderAllAssignments(container, estimates, pageType) {
    container.innerHTML = '';

    estimates.forEach(assignment => {
        const item = document.createElement('div');
        item.className = 'assignment-item';

        const title = cleanTitle(assignment.title);
        const { display, className } = getDueDateDisplay(assignment);
        const courseInfo = assignment.course && pageType === 'dashboard'
            ? `<div class="assignment-course">📚 ${assignment.course}</div>`
            : '';

        item.innerHTML = `
            ${courseInfo}
            <div class="assignment-title">${title}</div>
            <div class="assignment-meta">
                <span class="assignment-estimate">⏱️ ${assignment.estimate} ${typeof assignment.estimate === 'number' ? 'hours' : ''}</span>
                <span class="${className}">${display}</span>
            </div>
        `;

        container.appendChild(item);
    });
}

/**
 * Get due date display info
 */
function getDueDateDisplay(assignment) {
    let display = '';
    let className = 'assignment-due';

    if (assignment.dueDate) {
        const dueDate = new Date(assignment.dueDate);
        const now = new Date();
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
            display = `⚠️ Overdue (${assignment.dueDate})`;
            className += ' urgent';
        } else if (daysUntil <= 2) {
            display = `🔥 Due ${assignment.dueDate}`;
            className += ' urgent';
        } else {
            display = `📅 Due ${assignment.dueDate}`;
        }
    } else if (/\d+\s+out\s+of\s+\d+/i.test(assignment.title)) {
        display = '✅ Completed';
        className += ' completed';
    } else {
        display = '📋 No due date';
    }

    return { display, className };
}
