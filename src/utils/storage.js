/**
 * Chrome storage utilities for the Assignment Estimator extension
 */

import { STORAGE_KEYS, DEFAULT_PROVIDER, PROVIDER_CONFIGS, PROBLEMATIC_MODELS } from './constants.js';

/**
 * Get a value from Chrome sync storage
 * @param {string|string[]} keys - Storage key(s) to retrieve
 * @returns {Promise<Object>} Storage values
 */
export async function getStorage(keys) {
    return chrome.storage.sync.get(keys);
}

/**
 * Set values in Chrome sync storage
 * @param {Object} values - Key-value pairs to store
 * @returns {Promise<void>}
 */
export async function setStorage(values) {
    return chrome.storage.sync.set(values);
}

/**
 * Get the current LLM configuration
 * @returns {Promise<Object>} LLM configuration object
 */
export async function getLLMConfig() {
    const result = await getStorage([
        STORAGE_KEYS.LLM_PROVIDER,
        STORAGE_KEYS.HUGGINGFACE_API_KEY,
        STORAGE_KEYS.HUGGINGFACE_MODEL,
        STORAGE_KEYS.GOOGLE_API_KEY,
        STORAGE_KEYS.GOOGLE_MODEL,
        STORAGE_KEYS.OLLAMA_URL,
        STORAGE_KEYS.OLLAMA_MODEL,
        STORAGE_KEYS.OPENAI_API_KEY,
        STORAGE_KEYS.OPENAI_MODEL
    ]);

    const provider = result[STORAGE_KEYS.LLM_PROVIDER] || DEFAULT_PROVIDER;
    const providerConfig = PROVIDER_CONFIGS[provider];
    
    const config = {
        provider,
        apiKey: null,
        model: null,
        url: null
    };

    switch (provider) {
        case 'huggingface':
            config.apiKey = result[STORAGE_KEYS.HUGGINGFACE_API_KEY];
            config.model = result[STORAGE_KEYS.HUGGINGFACE_MODEL] || providerConfig.defaultModel;
            break;
        case 'google':
            config.apiKey = result[STORAGE_KEYS.GOOGLE_API_KEY];
            config.model = result[STORAGE_KEYS.GOOGLE_MODEL] || providerConfig.defaultModel;
            break;
        case 'ollama':
            config.url = result[STORAGE_KEYS.OLLAMA_URL] || providerConfig.defaultUrl;
            config.model = result[STORAGE_KEYS.OLLAMA_MODEL] || providerConfig.defaultModel;
            config.apiKey = 'ollama'; // Placeholder for readiness check
            break;
        case 'openai':
            config.apiKey = result[STORAGE_KEYS.OPENAI_API_KEY];
            config.model = result[STORAGE_KEYS.OPENAI_MODEL] || providerConfig.defaultModel;
            break;
    }

    return config;
}

/**
 * Check if the provider is configured and ready to use
 * @param {Object} config - LLM configuration
 * @returns {boolean} Whether the provider is ready
 */
export function isProviderReady(config) {
    return config.provider && (
        config.apiKey || 
        (config.provider === 'ollama' && config.url)
    );
}

/**
 * Migrate settings from old versions
 * @returns {Promise<void>}
 */
export async function migrateSettings() {
    try {
        const result = await getStorage([
            STORAGE_KEYS.HUGGINGFACE_MODEL,
            STORAGE_KEYS.LLM_PROVIDER,
            STORAGE_KEYS.OLLAMA_MODEL,
            STORAGE_KEYS.OLLAMA_URL
        ]);

        const updates = {};

        // Set Ollama as default provider if none set
        if (!result[STORAGE_KEYS.LLM_PROVIDER]) {
            updates[STORAGE_KEYS.LLM_PROVIDER] = 'ollama';
            updates[STORAGE_KEYS.OLLAMA_URL] = PROVIDER_CONFIGS.ollama.defaultUrl;
            updates[STORAGE_KEYS.OLLAMA_MODEL] = PROVIDER_CONFIGS.ollama.defaultModel;
        }

        // Update Ollama model if using old default
        if (result[STORAGE_KEYS.OLLAMA_MODEL] === 'llama2' || !result[STORAGE_KEYS.OLLAMA_MODEL]) {
            updates[STORAGE_KEYS.OLLAMA_MODEL] = PROVIDER_CONFIGS.ollama.defaultModel;
        }

        // Migrate problematic Hugging Face models
        if (result[STORAGE_KEYS.HUGGINGFACE_MODEL] && 
            PROBLEMATIC_MODELS.includes(result[STORAGE_KEYS.HUGGINGFACE_MODEL])) {
            updates[STORAGE_KEYS.HUGGINGFACE_MODEL] = PROVIDER_CONFIGS.huggingface.defaultModel;
        }

        if (Object.keys(updates).length > 0) {
            await setStorage(updates);
            console.log('[Storage] Settings migrated:', updates);
        }
    } catch (error) {
        console.error('[Storage] Migration error:', error);
    }
}

/**
 * Save all provider settings
 * @param {Object} settings - Settings object containing all provider configs
 * @returns {Promise<void>}
 */
export async function saveAllSettings(settings) {
    const storageValues = {
        [STORAGE_KEYS.LLM_PROVIDER]: settings.provider,
        [STORAGE_KEYS.HUGGINGFACE_API_KEY]: settings.huggingfaceApiKey || '',
        [STORAGE_KEYS.HUGGINGFACE_MODEL]: settings.huggingfaceModel || '',
        [STORAGE_KEYS.GOOGLE_API_KEY]: settings.googleApiKey || '',
        [STORAGE_KEYS.GOOGLE_MODEL]: settings.googleModel || '',
        [STORAGE_KEYS.OLLAMA_URL]: settings.ollamaUrl || '',
        [STORAGE_KEYS.OLLAMA_MODEL]: settings.ollamaModel || '',
        [STORAGE_KEYS.OPENAI_API_KEY]: settings.openaiApiKey || '',
        [STORAGE_KEYS.OPENAI_MODEL]: settings.openaiModel || ''
    };

    return setStorage(storageValues);
}
