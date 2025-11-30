/**
 * Base LLM Provider class
 * All providers extend this class
 */

export class BaseLLMProvider {
    constructor(config) {
        this.config = config;
    }

    /**
     * Get the provider name
     * @returns {string}
     */
    get name() {
        return 'Base Provider';
    }

    /**
     * Create an estimation prompt for an assignment
     * @param {Object} assignment - Assignment object
     * @returns {string} Formatted prompt
     */
    createPrompt(assignment) {
        const parts = [
            `Assignment Title: ${assignment.title || 'Unknown'}`,
            `Type: ${assignment.type || 'assignment'}`,
            `Course: ${assignment.course || 'Unknown Course'}`
        ];
        
        if (assignment.dueDate && assignment.dueDate !== 'null' && assignment.dueDate !== 'undefined') {
            parts.push(`Due Date: ${assignment.dueDate}`);
        }
        
        if (assignment.points && assignment.points > 0) {
            parts.push(`Points: ${assignment.points}`);
        }

        if (assignment.description && assignment.description.length > 0) {
            parts.push(`Description: ${assignment.description.substring(0, 500)}${assignment.description.length > 500 ? '...' : ''}`);
        }

        return parts.join('\n');
    }

    /**
     * Parse the estimate from API response
     * @param {string} text - Response text
     * @returns {number|null} Estimated hours or null
     */
    parseEstimate(text) {
        if (!text) return null;
        const numbers = text.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
            const estimate = parseFloat(numbers[0]);
            if (estimate >= 0.1 && estimate <= 100) {
                return estimate;
            }
        }
        return null;
    }

    /**
     * Call the API and get an estimate (to be implemented by subclasses)
     * @param {Object} assignment - Assignment object
     * @returns {Promise<number|null>} Estimated hours or null
     */
    async getEstimate(assignment) {
        throw new Error('getEstimate must be implemented by subclass');
    }

    /**
     * Test the connection (to be implemented by subclasses)
     * @returns {Promise<boolean>} Whether connection succeeded
     */
    async testConnection() {
        throw new Error('testConnection must be implemented by subclass');
    }
}
