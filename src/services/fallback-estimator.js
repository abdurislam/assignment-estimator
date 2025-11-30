/**
 * Fallback estimation service using rule-based logic
 * Used when LLM APIs are unavailable or fail
 */

import { DEFAULT_ESTIMATES, KEYWORD_ESTIMATES } from '../utils/constants.js';

/**
 * Get a fallback estimate based on assignment metadata
 * @param {Object} assignment - Assignment object
 * @returns {number} Estimated hours
 */
export function getFallbackEstimate(assignment) {
    const title = (assignment.title || '').toLowerCase();
    const type = (assignment.type || 'assignment').toLowerCase();
    let baseEstimate = DEFAULT_ESTIMATES.default;
    
    // Check title for specific keywords first
    for (const [keyword, estimate] of Object.entries(KEYWORD_ESTIMATES)) {
        if (title.includes(keyword)) {
            baseEstimate = estimate;
            break;
        }
    }
    
    // If no keyword match, try type-based estimation
    if (baseEstimate === DEFAULT_ESTIMATES.default) {
        for (const [key, estimate] of Object.entries(DEFAULT_ESTIMATES)) {
            if (type.includes(key)) {
                baseEstimate = estimate;
                break;
            }
        }
    }
    
    // Adjust based on points if available
    if (assignment.points) {
        const points = parseFloat(assignment.points);
        if (points <= 5) {
            baseEstimate *= 0.5;
        } else if (points >= 100) {
            baseEstimate *= 2;
        } else if (points >= 50) {
            baseEstimate *= 1.5;
        }
    }
    
    // Adjust based on description length if available
    if (assignment.description) {
        const wordCount = assignment.description.split(/\s+/).length;
        if (wordCount > 200) {
            baseEstimate *= 1.3;
        } else if (wordCount > 100) {
            baseEstimate *= 1.1;
        }
    }
    
    // Ensure reasonable bounds (0.25 to 20 hours)
    baseEstimate = Math.max(0.25, Math.min(20, baseEstimate));
    
    // Round to 1 decimal place
    return Math.round(baseEstimate * 10) / 10;
}
