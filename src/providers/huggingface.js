/**
 * Hugging Face LLM Provider
 */

import { BaseLLMProvider } from './base.js';

export class HuggingFaceProvider extends BaseLLMProvider {
    get name() {
        return 'Hugging Face';
    }

    async getEstimate(assignment) {
        console.log('[HuggingFace] Getting estimate for:', assignment.title);
        
        const prompt = this.createPrompt(assignment);
        
        const requestBody = {
            inputs: `Estimate completion time in hours for this assignment. Respond with only a number.\n\n${prompt}\n\nEstimated hours:`,
            parameters: {
                max_new_tokens: 10,
                temperature: 0.3,
                return_full_text: false,
                do_sample: false
            },
            options: {
                wait_for_model: true
            }
        };

        const url = `https://api-inference.huggingface.co/models/${this.config.model}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[HuggingFace] API error:', errorText);
            throw new Error(`Hugging Face API error: ${errorText}`);
        }

        const data = await response.json();
        console.log('[HuggingFace] Response:', data);
        
        const responseText = data[0]?.generated_text || data.generated_text || '';
        return this.parseEstimate(responseText);
    }

    async testConnection() {
        const response = await fetch(`https://api-inference.huggingface.co/models/${this.config.model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: 'Test connection. Respond with "OK".',
                parameters: { max_new_tokens: 5, temperature: 0.1 }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Hugging Face API error: ${errorData.error || response.statusText}`);
        }

        return true;
    }
}
