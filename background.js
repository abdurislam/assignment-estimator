// Background script for Assignment Estimator extension
// Handles API calls and message passing between content script and popup

class EstimationService {
    constructor() {
        this.defaultEstimates = {
            'quiz': 1,
            'exam': 3,
            'assignment': 4,
            'project': 8,
            'essay': 3,
            'homework': 2,
            'lab': 2,
            'reading': 1,
            'discussion': 0.5,
            'default': 2
        };
        
        // Migrate settings on startup
        this.migrateSettings();
    }

    async migrateSettings() {
        try {
            const result = await chrome.storage.sync.get(['huggingfaceModel', 'llmProvider']);
            
            console.log('[Background] Current settings before migration:', result);
            
            // List of problematic models that should be migrated
            const problematicModels = [
                'microsoft/DialoGPT-medium',
                'microsoft/DialoGPT-small',
                'microsoft/DialoGPT-large',
                'gpt2',
                'distilgpt2',  // Now include distilgpt2 since it's no longer deployed
                'bigcode/starcoder' // Old default model returning 404 on Inference API
            ];
            
            if (result.huggingfaceModel && problematicModels.includes(result.huggingfaceModel)) {
                console.log('[Background] Migrating problematic Hugging Face model:', result.huggingfaceModel);
                await chrome.storage.sync.set({ huggingfaceModel: 'bigcode/starcoder2-3b' });
                console.log('[Background] Migration complete: Updated to bigcode/starcoder2-3b');
            } else if (result.huggingfaceModel) {
                console.log('[Background] Current Hugging Face model:', result.huggingfaceModel);
            } else {
                console.log('[Background] No Hugging Face model found in settings, setting default');
                await chrome.storage.sync.set({ huggingfaceModel: 'bigcode/starcoder2-3b' });
            }
        } catch (error) {
            console.error('[Background] Error during migration:', error);
        }
    }

    async getEstimate(assignment) {
        console.log('[Background] Processing assignment:', assignment);
        
        try {
            // Get LLM configuration
            const config = await this.getLLMConfig();
            console.log('[Background] Using provider:', config.provider);
            
            if (config.provider && config.apiKey) {
                // Try LLM estimation first
                const llmEstimate = await this.callLLMAPI(assignment, config);
                if (llmEstimate && llmEstimate > 0) {
                    console.log('[Background] LLM estimate successful:', llmEstimate);
                    return llmEstimate;
                }
            }
            
            // Fallback to rule-based estimation
            console.log('[Background] Using fallback estimation');
            return this.getFallbackEstimate(assignment);
            
        } catch (error) {
            console.error('[Background] Error getting estimate:', error);
            // Return fallback estimate on error
            return this.getFallbackEstimate(assignment);
        }
    }

    async getLLMConfig() {
        const result = await chrome.storage.sync.get([
            'llmProvider',
            'huggingfaceApiKey', 'huggingfaceModel',
            'googleApiKey', 'googleModel',
            'ollamaUrl', 'ollamaModel',
            'openaiApiKey', 'openaiModel'
        ]);

        const config = {
            provider: result.llmProvider || null,
            apiKey: null,
            model: null,
            url: null
        };

        if (config.provider) {
            switch (config.provider) {
                case 'huggingface':
                    config.apiKey = result.huggingfaceApiKey;
                    // Use a working text generation model
                    config.model = result.huggingfaceModel || 'bigcode/starcoder2-3b';
                    break;
                case 'google':
                    config.apiKey = result.googleApiKey;
                    config.model = result.googleModel || 'gemini-pro';
                    break;
                case 'ollama':
                    config.url = result.ollamaUrl || 'http://localhost:11434';
                    config.model = result.ollamaModel || 'llama2';
                    break;
                case 'openai':
                    config.apiKey = result.openaiApiKey;
                    config.model = result.openaiModel || 'gpt-3.5-turbo';
                    break;
            }
        }

        return config;
    }

    async callLLMAPI(assignment, config) {
        switch (config.provider) {
            case 'huggingface':
                return await this.callHuggingFaceAPI(assignment, config);
            case 'google':
                return await this.callGoogleAI(assignment, config);
            case 'ollama':
                return await this.callOllamaAPI(assignment, config);
            case 'openai':
                return await this.callOpenAI(assignment, config);
            default:
                throw new Error(`Unknown provider: ${config.provider}`);
        }
    }

    async callHuggingFaceAPI(assignment, config) {
        console.log('[Background] Starting Hugging Face API call');
        console.log('[Background] Using model:', config.model);
        console.log('[Background] API Key present:', !!config.apiKey);
        
        const prompt = this.createEstimationPrompt(assignment);
        console.log('[Background] Generated prompt:', prompt);
        
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
        
        console.log('[Background] Hugging Face request body:', requestBody);
        
        const url = `https://api-inference.huggingface.co/models/${config.model}`;
        console.log('[Background] Request URL:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('[Background] Hugging Face response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Background] Hugging Face API error response:', errorText);
            console.error('[Background] Failed URL was:', url);
            throw new Error(`Hugging Face API error: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Background] Hugging Face response data:', data);
        
        const responseText = data[0]?.generated_text || data.generated_text || '';
        console.log('[Background] Extracted response text:', responseText);
        
        const estimate = this.parseEstimate(responseText);
        console.log('[Background] Parsed estimate:', estimate);
        return estimate;
    }

    async callGoogleAI(assignment, config) {
        console.log('[Background] Starting Google AI API call');
        const prompt = this.createEstimationPrompt(assignment);
        
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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Background] Google AI error:', errorData);
            throw new Error(`Google AI error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('[Background] Google AI response:', data);
        
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return this.parseEstimate(responseText);
    }

    async callOllamaAPI(assignment, config) {
        console.log('[Background] Starting Ollama API call');
        const prompt = this.createEstimationPrompt(assignment);
        
        const requestBody = {
            model: config.model,
            prompt: `Estimate completion time in hours for this assignment. Respond with only a number.\n\n${prompt}\n\nEstimated hours:`,
            stream: false,
            options: {
                num_predict: 10,
                temperature: 0.3
            }
        };

        const response = await fetch(`${config.url}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}. Make sure Ollama is running.`);
        }

        const data = await response.json();
        console.log('[Background] Ollama response:', data);
        
        return this.parseEstimate(data.response || '');
    }

    async callOpenAI(assignment, config) {
        console.log('[Background] Starting OpenAI API call');
        const prompt = this.createEstimationPrompt(assignment);
        
        const requestBody = {
            model: config.model,
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
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Background] OpenAI error:', errorData);
            throw new Error(`OpenAI error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('[Background] OpenAI response:', data);
        
        const responseText = data.choices?.[0]?.message?.content || '';
        return this.parseEstimate(responseText);
    }

    createEstimationPrompt(assignment) {
        const parts = [
            `Assignment: ${assignment.title}`,
            `Type: ${assignment.type}`,
            `Course: ${assignment.course}`,
            `Due: ${assignment.dueDate}`
        ];

        if (assignment.description && assignment.description.length > 0) {
            parts.push(`Description: ${assignment.description.substring(0, 500)}${assignment.description.length > 500 ? '...' : ''}`);
        }

        return parts.join('\n');
    }

    parseEstimate(text) {
        if (!text) return null;
        
        // Extract numbers from the response
        const numbers = text.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
            const estimate = parseFloat(numbers[0]);
            // Reasonable bounds check
            if (estimate >= 0.1 && estimate <= 100) {
                return estimate;
            }
        }
        
        return null;
    }

    getFallbackEstimate(assignment) {
        console.log('[Background] Using fallback estimation for:', assignment.type);
        
        // Determine assignment type
        const type = assignment.type.toLowerCase();
        let baseEstimate = this.defaultEstimates.default;
        
        // Match assignment type to estimates
        for (const [key, estimate] of Object.entries(this.defaultEstimates)) {
            if (type.includes(key)) {
                baseEstimate = estimate;
                break;
            }
        }
        
        // Adjust based on description length if available
        if (assignment.description) {
            const wordCount = assignment.description.split(/\s+/).length;
            if (wordCount > 200) {
                baseEstimate *= 1.5;
            } else if (wordCount > 100) {
                baseEstimate *= 1.2;
            }
        }
        
        // Adjust based on course complexity (simple heuristic)
        if (assignment.course.toLowerCase().includes('advanced') || 
            assignment.course.toLowerCase().includes('grad') ||
            assignment.course.toLowerCase().includes('senior')) {
            baseEstimate *= 1.3;
        }
        
        console.log('[Background] Fallback estimate:', baseEstimate);
        return Math.round(baseEstimate * 10) / 10; // Round to 1 decimal place
    }
}

// Initialize service
const estimationService = new EstimationService();

// Message listener for content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received message:', request);
    
    if (request.action === 'estimateTime') {
        estimationService.getEstimate(request.assignment)
            .then(estimate => {
                console.log('[Background] Sending estimate response:', estimate);
                sendResponse({ success: true, estimate });
            })
            .catch(error => {
                console.error('[Background] Error processing estimate:', error);
                // Send fallback estimate even on error
                const fallbackEstimate = estimationService.getFallbackEstimate(request.assignment);
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    estimate: fallbackEstimate 
                });
            });
        
        return true; // Indicates we will send a response asynchronously
    }
    
    if (request.action === 'getConfig') {
        estimationService.getLLMConfig()
            .then(config => {
                sendResponse({ success: true, config });
            })
            .catch(error => {
                console.error('[Background] Error getting config:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        return true;
    }
});

console.log('[Background] Assignment Estimator background script loaded');