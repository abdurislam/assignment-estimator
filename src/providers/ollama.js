/**
 * Ollama LLM Provider
 * Local LLM provider using Ollama
 */

import { BaseLLMProvider } from './base.js';

export class OllamaProvider extends BaseLLMProvider {
    get name() {
        return 'Ollama';
    }

    async getEstimate(assignment) {
        console.log('[Ollama] Getting estimate for:', assignment.title);
        
        const prompt = this.createPrompt(assignment);
        const systemPrompt = `You are an academic time estimation assistant. When given an assignment, estimate how many hours a typical student would need to complete it. Consider the assignment type, complexity, and any details provided. Respond with ONLY a single number representing hours (can include decimals like 1.5). Do not include any other text.`;
        
        const requestBody = {
            model: this.config.model,
            prompt: `${systemPrompt}\n\n${prompt}\n\nEstimated hours:`,
            stream: false,
            options: {
                num_predict: 20,
                temperature: 0.3
            }
        };

        try {
            const response = await fetch(`${this.config.url}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Ollama] API error:', errorText);
                throw new Error(`Ollama error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[Ollama] Response:', data);
            
            return this.parseEstimate(data.response || '');
        } catch (error) {
            console.error('[Ollama] Error:', error);
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to Ollama. Make sure Ollama is running.');
            }
            throw error;
        }
    }

    async testConnection() {
        const response = await fetch(`${this.config.url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                prompt: 'Test connection. Respond with "OK".',
                stream: false,
                options: { num_predict: 5 }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}. Make sure Ollama is running and the model is installed.`);
        }

        return true;
    }
}
