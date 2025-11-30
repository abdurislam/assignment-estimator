/**
 * Estimation Service
 * Main service for getting assignment time estimates
 */

import { createProvider } from '../providers/index.js';
import { getFallbackEstimate } from './fallback-estimator.js';
import { getLLMConfig, isProviderReady, migrateSettings } from '../utils/storage.js';

export class EstimationService {
    constructor() {
        this.initialize();
    }

    async initialize() {
        await migrateSettings();
    }

    /**
     * Get an estimate for an assignment
     * @param {Object} assignment - Assignment object
     * @returns {Promise<number>} Estimated hours
     */
    async getEstimate(assignment) {
        console.log('[EstimationService] Processing:', assignment.title);
        
        try {
            const config = await getLLMConfig();
            console.log('[EstimationService] Using provider:', config.provider);
            
            if (isProviderReady(config)) {
                const provider = createProvider(config);
                const estimate = await provider.getEstimate(assignment);
                
                if (estimate && estimate > 0) {
                    console.log('[EstimationService] LLM estimate:', estimate);
                    return estimate;
                }
            }
            
            // Fallback to rule-based estimation
            console.log('[EstimationService] Using fallback estimation');
            return getFallbackEstimate(assignment);
            
        } catch (error) {
            console.error('[EstimationService] Error:', error);
            return getFallbackEstimate(assignment);
        }
    }

    /**
     * Get fallback estimate (exposed for direct access)
     * @param {Object} assignment - Assignment object
     * @returns {number} Estimated hours
     */
    getFallbackEstimate(assignment) {
        return getFallbackEstimate(assignment);
    }
}
