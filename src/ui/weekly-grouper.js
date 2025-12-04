/**
 * Weekly Grouper - Groups assignments by week for display
 */

import { getWeekStart, formatShortDate } from '../utils/helpers.js';

/**
 * Group assignments by week
 * @param {Array} estimates - Array of assignments with estimates
 * @returns {Array} Array of [weekKey, weekData] tuples sorted by date
 */
export function groupByWeek(estimates) {
    const weeks = {};
    const now = new Date();
    const currentWeekStart = getWeekStart(now);

    estimates.forEach(assignment => {
        const { weekKey, weekLabel, weekStart, isCompleted } = categorizeAssignment(assignment, currentWeekStart);

        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                label: weekLabel,
                weekStart,
                assignments: [],
                totalHours: 0,
                isCurrentWeek: weekKey === currentWeekStart.toISOString().split('T')[0],
                isCompleted,
                isPast: weekStart && weekStart < currentWeekStart
            };
        }

        const hours = typeof assignment.estimate === 'number' ? assignment.estimate : 0;
        weeks[weekKey].assignments.push(assignment);
        weeks[weekKey].totalHours += hours;
    });

    // Sort weeks by date
    return Object.entries(weeks).sort((a, b) => {
        if (a[0] === 'completed') return 1;
        if (b[0] === 'completed') return -1;
        if (a[0] === 'no-date') return 1;
        if (b[0] === 'no-date') return -1;
        return new Date(a[0]) - new Date(b[0]);
    });
}

/**
 * Categorize an assignment into a week
 */
function categorizeAssignment(assignment, currentWeekStart) {
    const isCompleted = /\d+\s+out\s+of\s+\d+/i.test(assignment.title);

    if (isCompleted) {
        return {
            weekKey: 'completed',
            weekLabel: 'Completed',
            weekStart: null,
            isCompleted: true
        };
    }

    if (!assignment.dueDate) {
        return {
            weekKey: 'no-date',
            weekLabel: 'No Due Date',
            weekStart: null,
            isCompleted: false
        };
    }

    const dueDate = new Date(assignment.dueDate);
    const weekStart = getWeekStart(dueDate);
    const weekKey = weekStart.toISOString().split('T')[0];
    const diffDays = Math.floor((weekStart - currentWeekStart) / (1000 * 60 * 60 * 24));

    let weekLabel;
    if (diffDays === 0) {
        weekLabel = 'This Week';
    } else if (diffDays === 7) {
        weekLabel = 'Next Week';
    } else if (diffDays < 0) {
        weekLabel = 'Overdue';
    } else {
        const weekNum = Math.ceil(diffDays / 7) + 1;
        weekLabel = `Week ${weekNum} (${formatShortDate(weekStart)})`;
    }

    return { weekKey, weekLabel, weekStart, isCompleted: false };
}

/**
 * Calculate summary statistics from estimates
 * @param {Array} estimates - Array of assignments with estimates
 * @returns {Object} Stats object
 */
export function calculateStats(estimates) {
    let totalHours = 0;
    let upcomingCount = 0;
    let completedCount = 0;

    estimates.forEach(assignment => {
        const hours = typeof assignment.estimate === 'number' ? assignment.estimate : 0;
        totalHours += hours;

        if (/\d+\s+out\s+of\s+\d+/i.test(assignment.title) || assignment.dueDate === null) {
            completedCount++;
        } else {
            upcomingCount++;
        }
    });

    return { totalHours, upcomingCount, completedCount };
}
