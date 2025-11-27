// Options page script for managing settings
class SettingsManager {
    constructor() {
        this.currentProvider = 'huggingface'; // Default to free option
        this.initializeElements();
        this.loadSettings();
        this.bindEvents();
    }

    initializeElements() {
        this.tabs = document.querySelectorAll('.tab');
        this.sections = document.querySelectorAll('.provider-section');
        this.status = document.getElementById('status');
        this.saveBtn = document.getElementById('save-btn');
        this.testBtn = document.getElementById('test-btn');

        // Provider-specific elements
        this.elements = {
            huggingface: {
                apiKey: document.getElementById('hf-api-key'),
                model: document.getElementById('hf-model')
            },
            google: {
                apiKey: document.getElementById('google-api-key'),
                model: document.getElementById('google-model')
            },
            ollama: {
                url: document.getElementById('ollama-url'),
                model: document.getElementById('ollama-model')
            },
            openai: {
                apiKey: document.getElementById('openai-api-key'),
                model: document.getElementById('openai-model')
            }
        };
    }

    bindEvents() {
        this.saveBtn.addEventListener('click', () => this.saveSettings());
        this.testBtn.addEventListener('click', () => this.testConnection());

        // Tab switching
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchProvider(tab.dataset.provider));
        });
    }

    switchProvider(provider) {
        this.currentProvider = provider;

        // Update tabs
        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.provider === provider);
        });

        // Update sections
        this.sections.forEach(section => {
            section.classList.toggle('active', section.dataset.provider === provider);
        });
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                'llmProvider',
                'huggingfaceApiKey', 'huggingfaceModel',
                'googleApiKey', 'googleModel', 
                'ollamaUrl', 'ollamaModel',
                'openaiApiKey', 'openaiModel'
            ]);
            
            // Set current provider
            if (result.llmProvider) {
                this.switchProvider(result.llmProvider);
            }

            // Load Hugging Face settings
            if (result.huggingfaceApiKey) {
                this.elements.huggingface.apiKey.value = result.huggingfaceApiKey;
            }
            if (result.huggingfaceModel) {
                this.elements.huggingface.model.value = result.huggingfaceModel;
            }

            // Load Google AI settings
            if (result.googleApiKey) {
                this.elements.google.apiKey.value = result.googleApiKey;
            }
            if (result.googleModel) {
                this.elements.google.model.value = result.googleModel;
            }

            // Load Ollama settings
            if (result.ollamaUrl) {
                this.elements.ollama.url.value = result.ollamaUrl;
            }
            if (result.ollamaModel) {
                this.elements.ollama.model.value = result.ollamaModel;
            }

            // Load OpenAI settings
            if (result.openaiApiKey) {
                this.elements.openai.apiKey.value = result.openaiApiKey;
            }
            if (result.openaiModel) {
                this.elements.openai.model.value = result.openaiModel;
            }

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                llmProvider: this.currentProvider
            };

            // Save all provider settings
            settings.huggingfaceApiKey = this.elements.huggingface.apiKey.value.trim();
            settings.huggingfaceModel = this.elements.huggingface.model.value;
            
            settings.googleApiKey = this.elements.google.apiKey.value.trim();
            settings.googleModel = this.elements.google.model.value;
            
            settings.ollamaUrl = this.elements.ollama.url.value.trim();
            settings.ollamaModel = this.elements.ollama.model.value;
            
            settings.openaiApiKey = this.elements.openai.apiKey.value.trim();
            settings.openaiModel = this.elements.openai.model.value;

            // Validate current provider settings
            this.validateProviderSettings(settings);

            // Save to Chrome storage
            await chrome.storage.sync.set(settings);

            this.showStatus('success', `Settings saved! Using ${this.getProviderName(this.currentProvider)}`);
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatus('error', `Error saving settings: ${error.message}`);
        }
    }

    validateProviderSettings(settings) {
        switch (this.currentProvider) {
            case 'huggingface':
                if (settings.huggingfaceApiKey && !settings.huggingfaceApiKey.startsWith('hf_')) {
                    throw new Error('Hugging Face tokens start with "hf_"');
                }
                break;
            case 'google':
                if (settings.googleApiKey && !settings.googleApiKey.startsWith('AIza')) {
                    throw new Error('Google AI API keys typically start with "AIza"');
                }
                break;
            case 'ollama':
                if (settings.ollamaUrl && !settings.ollamaUrl.startsWith('http')) {
                    throw new Error('Ollama URL must start with http:// or https://');
                }
                break;
            case 'openai':
                if (settings.openaiApiKey && !settings.openaiApiKey.startsWith('sk-')) {
                    throw new Error('OpenAI API keys start with "sk-"');
                }
                break;
        }
    }

    async testConnection() {
        try {
            this.testBtn.disabled = true;
            this.testBtn.textContent = 'Testing...';
            this.showStatus('info', `Testing ${this.getProviderName(this.currentProvider)} connection...`);

            // Get current provider config
            const config = this.getCurrentProviderConfig();
            
            if (!config.hasRequiredFields) {
                throw new Error('Please fill in the required fields first');
            }

            // Test based on provider
            switch (this.currentProvider) {
                case 'huggingface':
                    await this.testHuggingFace(config);
                    break;
                case 'google':
                    await this.testGoogleAI(config);
                    break;
                case 'ollama':
                    await this.testOllama(config);
                    break;
                case 'openai':
                    await this.testOpenAI(config);
                    break;
            }

            this.showStatus('success', `${this.getProviderName(this.currentProvider)} connection successful!`);

        } catch (error) {
            console.error('Test failed:', error);
            this.showStatus('error', `Test failed: ${error.message}`);
        } finally {
            this.testBtn.disabled = false;
            this.testBtn.textContent = 'Test Connection';
        }
    }

    getCurrentProviderConfig() {
        switch (this.currentProvider) {
            case 'huggingface':
                return {
                    apiKey: this.elements.huggingface.apiKey.value.trim(),
                    model: this.elements.huggingface.model.value,
                    hasRequiredFields: !!this.elements.huggingface.apiKey.value.trim()
                };
            case 'google':
                return {
                    apiKey: this.elements.google.apiKey.value.trim(),
                    model: this.elements.google.model.value,
                    hasRequiredFields: !!this.elements.google.apiKey.value.trim()
                };
            case 'ollama':
                return {
                    url: this.elements.ollama.url.value.trim(),
                    model: this.elements.ollama.model.value,
                    hasRequiredFields: !!this.elements.ollama.url.value.trim()
                };
            case 'openai':
                return {
                    apiKey: this.elements.openai.apiKey.value.trim(),
                    model: this.elements.openai.model.value,
                    hasRequiredFields: !!this.elements.openai.apiKey.value.trim()
                };
        }
    }

    async testHuggingFace(config) {
        const response = await fetch(`https://api-inference.huggingface.co/models/${config.model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
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
    }

    async testGoogleAI(config) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Test connection. Respond with "OK".' }] }],
                generationConfig: { maxOutputTokens: 5 }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Google AI error: ${errorData.error?.message || response.statusText}`);
        }
    }

    async testOllama(config) {
        const response = await fetch(`${config.url}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                prompt: 'Test connection. Respond with "OK".',
                stream: false,
                options: { num_predict: 5 }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}. Make sure Ollama is running and the model is installed.`);
        }
    }

    async testOpenAI(config) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'user', content: 'Test connection. Respond with "OK".' }],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI error: ${errorData.error?.message || response.statusText}`);
        }
    }

    getProviderName(provider) {
        const names = {
            huggingface: 'Hugging Face',
            google: 'Google AI',
            ollama: 'Ollama',
            openai: 'OpenAI'
        };
        return names[provider] || provider;
    }

    showStatus(type, message) {
        this.status.className = `status ${type}`;
        this.status.textContent = message;
        this.status.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                this.status.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});