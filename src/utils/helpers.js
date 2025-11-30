/**
 * Shared helper functions for the Assignment Estimator extension
 */

/**
 * Parse a number from text, looking for decimal or integer values
 * @param {string} text - Text containing a number
 * @returns {number|null} Parsed number or null
 */
export function parseNumber(text) {
    if (!text) return null;
    const numbers = text.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length > 0) {
        return parseFloat(numbers[0]);
    }
    return null;
}

/**
 * Parse an estimate from LLM response text
 * @param {string} text - LLM response text
 * @returns {number|null} Estimated hours or null
 */
export function parseEstimate(text) {
    if (!text) return null;
    const estimate = parseNumber(text);
    // Reasonable bounds check (0.1 to 100 hours)
    if (estimate !== null && estimate >= 0.1 && estimate <= 100) {
        return estimate;
    }
    return null;
}

/**
 * Parse points from text
 * @param {string} pointsText - Text containing points
 * @returns {number|null} Parsed points or null
 */
export function parsePoints(pointsText) {
    return parseNumber(pointsText);
}

/**
 * Parse a due date from various text formats
 * @param {string} dateText - Text containing a date
 * @returns {string|null} Formatted date string or null
 */
export function parseDueDate(dateText) {
    if (!dateText || dateText.toLowerCase().includes('no due date')) {
        return null;
    }
    
    // Clean up the date text
    let cleaned = dateText.replace(/^due\s+/i, '').trim();
    cleaned = cleaned.replace(/\s+at\s+\d+:\d+\s*[ap]m/i, '');
    cleaned = cleaned.replace(/\s+\d+:\d+\s*[ap]m/i, '');
    
    // Handle incomplete dates
    if (cleaned.match(/^\/\d{1,2}$/)) return null;
    
    // Handle invalid years
    if (/200[01]|1999/.test(cleaned)) return null;
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    const dateFormats = [
        // Short month format: "Dec 2" or "Dec 15"
        () => {
            const match = cleaned.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
            if (match) {
                const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthIndex = monthNames.indexOf(match[1].toLowerCase());
                let year = match[3] ? parseInt(match[3]) : currentYear;
                if (!match[3] && monthIndex < currentMonth) {
                    year = currentYear + 1;
                }
                return new Date(`${match[1]} ${match[2]}, ${year}`);
            }
            return null;
        },
        // Full month format
        () => {
            const match = cleaned.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i);
            if (match) {
                const year = match[3] || currentYear;
                return new Date(`${match[1]} ${match[2]}, ${year}`);
            }
            return null;
        },
        // Direct parsing
        () => new Date(cleaned),
        // With current year
        () => new Date(`${cleaned}, ${currentYear}`),
        // Month/day format
        () => {
            const match = cleaned.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
            if (match) {
                const year = match[3] || currentYear;
                if (year >= currentYear && year <= currentYear + 1) {
                    return new Date(`${match[1]}/${match[2]}/${year}`);
                }
            }
            return null;
        },
        // Text format with context
        () => {
            const match = cleaned.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
            if (match) {
                const year = match[3] || currentYear;
                if (year >= currentYear && year <= currentYear + 1) {
                    return new Date(`${match[1]} ${match[2]}, ${year}`);
                }
            }
            return null;
        },
        // ISO format
        () => cleaned.match(/^\d{4}-\d{2}-\d{2}/) ? new Date(cleaned) : null
    ];
    
    for (const formatFn of dateFormats) {
        try {
            const date = formatFn();
            if (date && !isNaN(date.getTime())) {
                const now = new Date();
                const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
                
                if (date >= oneYearAgo && date <= twoYearsFromNow) {
                    return date.toLocaleDateString();
                }
            }
        } catch (e) {
            // Continue to next format
        }
    }
    
    return null;
}

/**
 * Clean assignment title by removing course codes, scores, etc.
 * @param {string} title - Raw assignment title
 * @returns {string} Cleaned title
 */
export function cleanTitle(title) {
    if (!title) return '';
    let cleaned = title;
    
    // Remove course codes like "CPT_S-437-PULLM-1-LEC"
    cleaned = cleaned.replace(/\s+[A-Z]{2,8}[_-][A-Z0-9-]+/gi, '');
    
    // Remove score patterns like "1 out of 1", "100 out of 100"
    cleaned = cleaned.replace(/\s*\d+\s+out\s+of\s+\d+/gi, '');
    
    // Remove quotes and extra text
    cleaned = cleaned.replace(/\s*"[^"]*"/g, '');
    
    // Remove dates from end of title
    const datePatterns = [
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2}(?:,?\s*\d{4})?$/i,
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{1,2}(?:,?\s*\d{4})?$/i
    ];
    for (const pattern of datePatterns) {
        cleaned = cleaned.replace(pattern, '').trim();
    }
    
    return cleaned.trim();
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element|null>} The element or null if timeout
 */
export function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

/**
 * Deduplicate assignments by URL or title
 * @param {Array} assignments - Array of assignment objects
 * @returns {Array} Deduplicated array
 */
export function deduplicateAssignments(assignments) {
    const seen = new Set();
    return assignments.filter(assignment => {
        const key = assignment.url || assignment.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Get the start of the week (Monday) for a given date
 * @param {Date} date - The date
 * @returns {Date} Start of the week
 */
export function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

/**
 * Format a date as "Mon DD" format
 * @param {Date} date - The date to format
 * @returns {string} Formatted date
 */
export function formatShortDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Show a status message in the UI
 * @param {HTMLElement} element - Status element
 * @param {string} type - Status type: 'success', 'error', 'info', 'loading'
 * @param {string} message - Status message
 * @param {number} autoHide - Auto-hide timeout in ms (0 = no auto-hide)
 */
export function showStatus(element, type, message, autoHide = 0) {
    element.className = `status ${type}`;
    element.textContent = message;
    element.style.display = 'block';
    
    if (autoHide > 0) {
        setTimeout(() => {
            element.style.display = 'none';
        }, autoHide);
    }
}

/**
 * Create a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Log a message with a prefix for debugging
 * @param {string} prefix - Log prefix (e.g., '[Popup]')
 * @param  {...any} args - Arguments to log
 */
export function log(prefix, ...args) {
    console.log(prefix, ...args);
}

/**
 * Log an error with a prefix for debugging
 * @param {string} prefix - Log prefix (e.g., '[Popup]')
 * @param  {...any} args - Arguments to log
 */
export function logError(prefix, ...args) {
    console.error(prefix, ...args);
}
