/**
 * LLM Provider Factory
 * Creates the appropriate provider based on configuration
 */

import { OllamaProvider } from './ollama.js';
import { HuggingFaceProvider } from './huggingface.js';
import { GoogleAIProvider } from './google.js';
import { OpenAIProvider } from './openai.js';
import { PROVIDERS } from '../utils/constants.js';

/**
 * Create a provider instance based on config
 * @param {Object} config - LLM configuration
 * @returns {BaseLLMProvider} Provider instance
 */
export function createProvider(config) {
    switch (config.provider) {
        case PROVIDERS.OLLAMA:
            return new OllamaProvider(config);
        case PROVIDERS.HUGGINGFACE:
            return new HuggingFaceProvider(config);
        case PROVIDERS.GOOGLE:
            return new GoogleAIProvider(config);
        case PROVIDERS.OPENAI:
            return new OpenAIProvider(config);
        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}

/**
 * Get provider display name
 * @param {string} provider - Provider ID
 * @returns {string} Display name
 */
export function getProviderName(provider) {
    const names = {
        [PROVIDERS.HUGGINGFACE]: 'Hugging Face',
        [PROVIDERS.GOOGLE]: 'Google AI',
        [PROVIDERS.OLLAMA]: 'Ollama',
        [PROVIDERS.OPENAI]: 'OpenAI'
    };
    return names[provider] || provider;
}

// Re-export providers
export { OllamaProvider, HuggingFaceProvider, GoogleAIProvider, OpenAIProvider };
