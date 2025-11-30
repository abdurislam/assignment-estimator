/**
 * Background Service Worker for Assignment Estimator
 * Handles LLM API calls and message passing
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const PROVIDERS = {
    HUGGINGFACE: 'huggingface',
    GOOGLE: 'google',
    OLLAMA: 'ollama',
    OPENAI: 'openai'
};

const DEFAULT_PROVIDER = PROVIDERS.OLLAMA;

const PROVIDER_CONFIGS = {
    [PROVIDERS.HUGGINGFACE]: {
        name: 'Hugging Face',
        defaultModel: 'mistralai/Mistral-7B-Instruct-v0.2'
    },
    [PROVIDERS.GOOGLE]: {
        name: 'Google AI',
        defaultModel: 'gemini-pro'
    },
    [PROVIDERS.OLLAMA]: {
        name: 'Ollama',
        defaultModel: 'llama3.1:8b',
        defaultUrl: 'http://localhost:11434'
    },
    [PROVIDERS.OPENAI]: {
        name: 'OpenAI',
        defaultModel: 'gpt-3.5-turbo'
    }
};

const KEYWORD_ESTIMATES = {
    'quiz': 0.5, 'in class quiz': 0.5, 'in-class quiz': 0.5,
    'checkpoint': 0.5, 'check point': 0.5, 'survey': 0.5, 'discussion': 0.5,
    'reading': 1, 'lab': 2, 'final': 3, 'certificate': 3, 'exam': 3, 'midterm': 3,
    'report': 4, 'draft': 4, 'essay': 4, 'paper': 4,
    'presentation': 5, 'poster': 5, 'project': 8
};

const DEFAULT_ESTIMATES = {
    quiz: 1, exam: 3, assignment: 4, project: 8, essay: 3,
    homework: 2, lab: 2, reading: 1, discussion: 0.5, default: 2
};

const PROBLEMATIC_MODELS = [
    'microsoft/DialoGPT-medium', 'microsoft/DialoGPT-small', 'microsoft/DialoGPT-large',
    'gpt2', 'distilgpt2', 'bigcode/starcoder', 'bigcode/starcoder2-3b'
];

// ============================================================================
// STORAGE HELPERS
// ============================================================================

async function getLLMConfig() {
    const result = await chrome.storage.sync.get([
        'llmProvider', 'huggingfaceApiKey', 'huggingfaceModel',
        'googleApiKey', 'googleModel', 'ollamaUrl', 'ollamaModel',
        'openaiApiKey', 'openaiModel'
    ]);

    const provider = result.llmProvider || DEFAULT_PROVIDER;
    const config = { provider, apiKey: null, model: null, url: null };

    switch (provider) {
        case PROVIDERS.HUGGINGFACE:
            config.apiKey = result.huggingfaceApiKey;
            config.model = result.huggingfaceModel || PROVIDER_CONFIGS[provider].defaultModel;
            break;
        case PROVIDERS.GOOGLE:
            config.apiKey = result.googleApiKey;
            config.model = result.googleModel || PROVIDER_CONFIGS[provider].defaultModel;
            break;
        case PROVIDERS.OLLAMA:
            config.url = result.ollamaUrl || PROVIDER_CONFIGS[provider].defaultUrl;
            config.model = result.ollamaModel || PROVIDER_CONFIGS[provider].defaultModel;
            config.apiKey = 'ollama'; // Placeholder for readiness check
            break;
        case PROVIDERS.OPENAI:
            config.apiKey = result.openaiApiKey;
            config.model = result.openaiModel || PROVIDER_CONFIGS[provider].defaultModel;
            break;
    }

    return config;
}

function isProviderReady(config) {
    return config.provider && (config.apiKey || (config.provider === PROVIDERS.OLLAMA && config.url));
}

async function migrateSettings() {
    try {
        const result = await chrome.storage.sync.get([
            'huggingfaceModel', 'llmProvider', 'ollamaModel', 'ollamaUrl'
        ]);

        const updates = {};

        if (!result.llmProvider) {
            updates.llmProvider = PROVIDERS.OLLAMA;
            updates.ollamaUrl = PROVIDER_CONFIGS[PROVIDERS.OLLAMA].defaultUrl;
            updates.ollamaModel = PROVIDER_CONFIGS[PROVIDERS.OLLAMA].defaultModel;
        }

        if (result.ollamaModel === 'llama2' || !result.ollamaModel) {
            updates.ollamaModel = PROVIDER_CONFIGS[PROVIDERS.OLLAMA].defaultModel;
        }

        if (result.huggingfaceModel && PROBLEMATIC_MODELS.includes(result.huggingfaceModel)) {
            updates.huggingfaceModel = PROVIDER_CONFIGS[PROVIDERS.HUGGINGFACE].defaultModel;
        }

        if (Object.keys(updates).length > 0) {
            await chrome.storage.sync.set(updates);
            console.log('[Background] Settings migrated:', updates);
        }
    } catch (error) {
        console.error('[Background] Migration error:', error);
    }
}

// ============================================================================
// PROMPT HELPERS
// ============================================================================

function createPrompt(assignment) {
    const parts = [
        `Assignment Title: ${assignment.title || 'Unknown'}`,
        `Type: ${assignment.type || 'assignment'}`,
        `Course: ${assignment.course || 'Unknown Course'}`
    ];

    if (assignment.dueDate && assignment.dueDate !== 'null') {
        parts.push(`Due Date: ${assignment.dueDate}`);
    }
    if (assignment.points && assignment.points > 0) {
        parts.push(`Points: ${assignment.points}`);
    }
    if (assignment.description) {
        parts.push(`Description: ${assignment.description.substring(0, 500)}`);
    }

    return parts.join('\n');
}

function parseEstimate(text) {
    if (!text) return null;
    const numbers = text.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length > 0) {
        const estimate = parseFloat(numbers[0]);
        if (estimate >= 0.1 && estimate <= 100) return estimate;
    }
    return null;
}

// ============================================================================
// LLM PROVIDERS
// ============================================================================

async function callOllamaAPI(assignment, config) {
    console.log('[Ollama] Calling API');
    
    const prompt = createPrompt(assignment);
    const systemPrompt = `You are an academic time estimation assistant. Estimate how many hours a typical student needs to complete the assignment. Respond with ONLY a single number (can include decimals like 1.5).`;

    const response = await fetch(`${config.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: config.model,
            prompt: `${systemPrompt}\n\n${prompt}\n\nEstimated hours:`,
            stream: false,
            options: { num_predict: 20, temperature: 0.3 }
        })
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
    
    const data = await response.json();
    return parseEstimate(data.response || '');
}

async function callHuggingFaceAPI(assignment, config) {
    console.log('[HuggingFace] Calling API');
    
    const prompt = createPrompt(assignment);

    const response = await fetch(`https://api-inference.huggingface.co/models/${config.model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: `Estimate hours to complete: ${prompt}\n\nHours:`,
            parameters: { max_new_tokens: 10, temperature: 0.3 },
            options: { wait_for_model: true }
        })
    });

    if (!response.ok) throw new Error(`HuggingFace error: ${response.statusText}`);
    
    const data = await response.json();
    return parseEstimate(data[0]?.generated_text || data.generated_text || '');
}

async function callGoogleAPI(assignment, config) {
    console.log('[Google] Calling API');
    
    const prompt = createPrompt(assignment);

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Estimate hours (respond with only a number):\n\n${prompt}` }] }],
                generationConfig: { maxOutputTokens: 10, temperature: 0.3 }
            })
        }
    );

    if (!response.ok) throw new Error(`Google AI error: ${response.statusText}`);
    
    const data = await response.json();
    return parseEstimate(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

async function callOpenAIAPI(assignment, config) {
    console.log('[OpenAI] Calling API');
    
    const prompt = createPrompt(assignment);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: `Estimate hours (respond with only a number):\n\n${prompt}` }],
            max_tokens: 10,
            temperature: 0.3
        })
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
    
    const data = await response.json();
    return parseEstimate(data.choices?.[0]?.message?.content || '');
}

async function callLLMAPI(assignment, config) {
    switch (config.provider) {
        case PROVIDERS.OLLAMA: return callOllamaAPI(assignment, config);
        case PROVIDERS.HUGGINGFACE: return callHuggingFaceAPI(assignment, config);
        case PROVIDERS.GOOGLE: return callGoogleAPI(assignment, config);
        case PROVIDERS.OPENAI: return callOpenAIAPI(assignment, config);
        default: throw new Error(`Unknown provider: ${config.provider}`);
    }
}

// ============================================================================
// FALLBACK ESTIMATION
// ============================================================================

function getFallbackEstimate(assignment) {
    const title = (assignment.title || '').toLowerCase();
    const type = (assignment.type || 'assignment').toLowerCase();
    let estimate = DEFAULT_ESTIMATES.default;

    // Check keywords first
    for (const [keyword, hours] of Object.entries(KEYWORD_ESTIMATES)) {
        if (title.includes(keyword)) {
            estimate = hours;
            break;
        }
    }

    // Fall back to type-based if no keyword match
    if (estimate === DEFAULT_ESTIMATES.default) {
        for (const [key, hours] of Object.entries(DEFAULT_ESTIMATES)) {
            if (type.includes(key)) {
                estimate = hours;
                break;
            }
        }
    }

    // Adjust for points
    if (assignment.points) {
        const points = parseFloat(assignment.points);
        if (points <= 5) estimate *= 0.5;
        else if (points >= 100) estimate *= 2;
        else if (points >= 50) estimate *= 1.5;
    }

    // Adjust for description length
    if (assignment.description) {
        const wordCount = assignment.description.split(/\s+/).length;
        if (wordCount > 200) estimate *= 1.3;
        else if (wordCount > 100) estimate *= 1.1;
    }

    return Math.round(Math.max(0.25, Math.min(20, estimate)) * 10) / 10;
}

// ============================================================================
// MAIN ESTIMATION SERVICE
// ============================================================================

async function getEstimate(assignment) {
    console.log('[Background] Processing:', assignment.title);

    try {
        const config = await getLLMConfig();
        console.log('[Background] Provider:', config.provider);

        if (isProviderReady(config)) {
            const estimate = await callLLMAPI(assignment, config);
            if (estimate && estimate > 0) {
                console.log('[Background] LLM estimate:', estimate);
                return estimate;
            }
        }

        console.log('[Background] Using fallback');
        return getFallbackEstimate(assignment);

    } catch (error) {
        console.error('[Background] Error:', error);
        return getFallbackEstimate(assignment);
    }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Message:', request.action);

    if (request.action === 'estimateTime') {
        getEstimate(request.assignment)
            .then(estimate => sendResponse({ success: true, estimate }))
            .catch(error => sendResponse({
                success: false,
                error: error.message,
                estimate: getFallbackEstimate(request.assignment)
            }));
        return true;
    }

    if (request.action === 'getConfig') {
        getLLMConfig()
            .then(config => sendResponse({ success: true, config }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

migrateSettings();
console.log('[Background] Assignment Estimator loaded');
