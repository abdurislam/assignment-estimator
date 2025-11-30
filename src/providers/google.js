/**
 * Google AI (Gemini) LLM Provider
 */

import { BaseLLMProvider } from './base.js';

export class GoogleAIProvider extends BaseLLMProvider {
    get name() {
        return 'Google AI';
    }

    async getEstimate(assignment) {
        console.log('[GoogleAI] Getting estimate for:', assignment.title);
        
        const prompt = this.createPrompt(assignment);
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: `Estimate completion time in hours for this assignment. Respond with only a number.\n\n${prompt}\n\nEstimated hours:`
                }]
            }],
            generationConfig: {
                maxOutputTokens: 10,
                temperature: 0.3
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[GoogleAI] API error:', errorData);
            throw new Error(`Google AI error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('[GoogleAI] Response:', data);
        
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return this.parseEstimate(responseText);
    }

    async testConnection() {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Test connection. Respond with "OK".' }] }],
                    generationConfig: { maxOutputTokens: 5 }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google AI error: ${errorData.error?.message || response.statusText}`);
        }

        return true;
    }
}
