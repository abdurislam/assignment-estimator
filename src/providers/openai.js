/**
 * OpenAI LLM Provider
 */

import { BaseLLMProvider } from './base.js';

export class OpenAIProvider extends BaseLLMProvider {
    get name() {
        return 'OpenAI';
    }

    async getEstimate(assignment) {
        console.log('[OpenAI] Getting estimate for:', assignment.title);
        
        const prompt = this.createPrompt(assignment);
        
        const requestBody = {
            model: this.config.model,
            messages: [{
                role: 'user',
                content: `Estimate completion time in hours for this assignment. Respond with only a number.\n\n${prompt}\n\nEstimated hours:`
            }],
            max_tokens: 10,
            temperature: 0.3
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[OpenAI] API error:', errorData);
            throw new Error(`OpenAI error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('[OpenAI] Response:', data);
        
        const responseText = data.choices?.[0]?.message?.content || '';
        return this.parseEstimate(responseText);
    }

    async testConnection() {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [{ role: 'user', content: 'Test connection. Respond with "OK".' }],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI error: ${errorData.error?.message || response.statusText}`);
        }

        return true;
    }
}
