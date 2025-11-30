/**
 * Options Page Script for Assignment Estimator
 * Handles settings management
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const PROVIDER_NAMES = {
    huggingface: 'Hugging Face',
    google: 'Google AI',
    ollama: 'Ollama',
    openai: 'OpenAI'
};

// ============================================================================
// MAIN CLASS
// ============================================================================

class SettingsManager {
    constructor() {
        this.currentProvider = 'ollama';
        this.initElements();
        this.loadSettings();
        this.bindEvents();
    }

    initElements() {
        this.tabs = document.querySelectorAll('.tab');
        this.sections = document.querySelectorAll('.provider-section');
        this.status = document.getElementById('status');
        this.saveBtn = document.getElementById('save-btn');
        this.testBtn = document.getElementById('test-btn');

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
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchProvider(tab.dataset.provider));
        });
    }

    switchProvider(provider) {
        this.currentProvider = provider;
        this.tabs.forEach(t => t.classList.toggle('active', t.dataset.provider === provider));
        this.sections.forEach(s => s.classList.toggle('active', s.dataset.provider === provider));
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

            if (result.llmProvider) this.switchProvider(result.llmProvider);
            if (result.huggingfaceApiKey) this.elements.huggingface.apiKey.value = result.huggingfaceApiKey;
            if (result.huggingfaceModel) this.elements.huggingface.model.value = result.huggingfaceModel;
            if (result.googleApiKey) this.elements.google.apiKey.value = result.googleApiKey;
            if (result.googleModel) this.elements.google.model.value = result.googleModel;
            if (result.ollamaUrl) this.elements.ollama.url.value = result.ollamaUrl;
            if (result.ollamaModel) this.elements.ollama.model.value = result.ollamaModel;
            if (result.openaiApiKey) this.elements.openai.apiKey.value = result.openaiApiKey;
            if (result.openaiModel) this.elements.openai.model.value = result.openaiModel;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const settings = {
                llmProvider: this.currentProvider,
                huggingfaceApiKey: this.elements.huggingface.apiKey.value.trim(),
                huggingfaceModel: this.elements.huggingface.model.value,
                googleApiKey: this.elements.google.apiKey.value.trim(),
                googleModel: this.elements.google.model.value,
                ollamaUrl: this.elements.ollama.url.value.trim(),
                ollamaModel: this.elements.ollama.model.value,
                openaiApiKey: this.elements.openai.apiKey.value.trim(),
                openaiModel: this.elements.openai.model.value
            };

            this.validateSettings(settings);
            await chrome.storage.sync.set(settings);
            this.showStatus('success', `Settings saved! Using ${PROVIDER_NAMES[this.currentProvider]}`);
        } catch (error) {
            this.showStatus('error', `Error: ${error.message}`);
        }
    }

    validateSettings(settings) {
        switch (this.currentProvider) {
            case 'huggingface':
                if (settings.huggingfaceApiKey && !settings.huggingfaceApiKey.startsWith('hf_'))
                    throw new Error('Hugging Face tokens start with "hf_"');
                break;
            case 'google':
                if (settings.googleApiKey && !settings.googleApiKey.startsWith('AIza'))
                    throw new Error('Google AI API keys start with "AIza"');
                break;
            case 'ollama':
                if (settings.ollamaUrl && !settings.ollamaUrl.startsWith('http'))
                    throw new Error('Ollama URL must start with http:// or https://');
                break;
            case 'openai':
                if (settings.openaiApiKey && !settings.openaiApiKey.startsWith('sk-'))
                    throw new Error('OpenAI API keys start with "sk-"');
                break;
        }
    }

    async testConnection() {
        try {
            this.testBtn.disabled = true;
            this.testBtn.textContent = 'Testing...';
            this.showStatus('info', `Testing ${PROVIDER_NAMES[this.currentProvider]}...`);

            const config = this.getConfig();
            if (!config.hasRequiredFields) throw new Error('Please fill in required fields');

            await this.testProvider(config);
            this.showStatus('success', `${PROVIDER_NAMES[this.currentProvider]} connection successful!`);
        } catch (error) {
            this.showStatus('error', `Test failed: ${error.message}`);
        } finally {
            this.testBtn.disabled = false;
            this.testBtn.textContent = 'Test Connection';
        }
    }

    getConfig() {
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

    async testProvider(config) {
        let url, body, headers;

        switch (this.currentProvider) {
            case 'huggingface':
                url = `https://api-inference.huggingface.co/models/${config.model}`;
                headers = { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' };
                body = { inputs: 'Test', parameters: { max_new_tokens: 5 } };
                break;
            case 'google':
                url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
                headers = { 'Content-Type': 'application/json' };
                body = { contents: [{ parts: [{ text: 'Test' }] }], generationConfig: { maxOutputTokens: 5 } };
                break;
            case 'ollama':
                url = `${config.url}/api/generate`;
                headers = { 'Content-Type': 'application/json' };
                body = { model: config.model, prompt: 'Test', stream: false, options: { num_predict: 5 } };
                break;
            case 'openai':
                url = 'https://api.openai.com/v1/chat/completions';
                headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
                body = { model: config.model, messages: [{ role: 'user', content: 'Test' }], max_tokens: 5 };
                break;
        }

        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    }

    showStatus(type, message) {
        this.status.className = `status ${type}`;
        this.status.textContent = message;
        this.status.style.display = 'block';
        if (type === 'success') setTimeout(() => { this.status.style.display = 'none'; }, 3000);
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => new SettingsManager());
