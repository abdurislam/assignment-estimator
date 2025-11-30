/**
 * Shared constants for the Assignment Estimator extension
 */

export const PROVIDERS = {
    HUGGINGFACE: 'huggingface',
    GOOGLE: 'google',
    OLLAMA: 'ollama',
    OPENAI: 'openai'
};

export const DEFAULT_PROVIDER = PROVIDERS.OLLAMA;

export const PROVIDER_CONFIGS = {
    [PROVIDERS.HUGGINGFACE]: {
        name: 'Hugging Face',
        defaultModel: 'mistralai/Mistral-7B-Instruct-v0.2',
        apiKeyPrefix: 'hf_',
        baseUrl: 'https://api-inference.huggingface.co/models'
    },
    [PROVIDERS.GOOGLE]: {
        name: 'Google AI',
        defaultModel: 'gemini-pro',
        apiKeyPrefix: 'AIza',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models'
    },
    [PROVIDERS.OLLAMA]: {
        name: 'Ollama',
        defaultModel: 'llama3.1:8b',
        defaultUrl: 'http://localhost:11434',
        apiKeyPrefix: null
    },
    [PROVIDERS.OPENAI]: {
        name: 'OpenAI',
        defaultModel: 'gpt-3.5-turbo',
        apiKeyPrefix: 'sk-',
        baseUrl: 'https://api.openai.com/v1'
    }
};

export const DEFAULT_ESTIMATES = {
    quiz: 1,
    exam: 3,
    assignment: 4,
    project: 8,
    essay: 3,
    homework: 2,
    lab: 2,
    reading: 1,
    discussion: 0.5,
    default: 2
};

export const KEYWORD_ESTIMATES = {
    // Quick items
    'quiz': 0.5,
    'in class quiz': 0.5,
    'in-class quiz': 0.5,
    'checkpoint': 0.5,
    'check point': 0.5,
    'survey': 0.5,
    'discussion': 0.5,
    
    // Short items
    'reading': 1,
    
    // Medium items
    'lab': 2,
    'final': 3,
    'certificate': 3,
    'exam': 3,
    'midterm': 3,
    
    // Long items
    'report': 4,
    'draft': 4,
    'essay': 4,
    'paper': 4,
    
    // Very long items
    'presentation': 5,
    'poster': 5,
    
    // Major items
    'project': 8
};

export const PAGE_TYPES = {
    DASHBOARD: 'dashboard',
    ASSIGNMENT_DETAIL: 'assignment_detail',
    ASSIGNMENTS_LIST: 'assignments_list',
    MODULES: 'modules',
    SYLLABUS: 'syllabus',
    COURSE_HOME: 'course_home',
    OTHER: 'other'
};

export const PAGE_TYPE_LABELS = {
    [PAGE_TYPES.DASHBOARD]: 'Canvas Dashboard',
    [PAGE_TYPES.ASSIGNMENT_DETAIL]: 'Assignment Page',
    [PAGE_TYPES.ASSIGNMENTS_LIST]: 'Assignments List',
    [PAGE_TYPES.MODULES]: 'Course Modules',
    [PAGE_TYPES.SYLLABUS]: 'Course Syllabus',
    [PAGE_TYPES.COURSE_HOME]: 'Course Home',
    [PAGE_TYPES.OTHER]: 'Canvas Page'
};

export const STORAGE_KEYS = {
    LLM_PROVIDER: 'llmProvider',
    HUGGINGFACE_API_KEY: 'huggingfaceApiKey',
    HUGGINGFACE_MODEL: 'huggingfaceModel',
    GOOGLE_API_KEY: 'googleApiKey',
    GOOGLE_MODEL: 'googleModel',
    OLLAMA_URL: 'ollamaUrl',
    OLLAMA_MODEL: 'ollamaModel',
    OPENAI_API_KEY: 'openaiApiKey',
    OPENAI_MODEL: 'openaiModel'
};

export const PROBLEMATIC_MODELS = [
    'microsoft/DialoGPT-medium',
    'microsoft/DialoGPT-small',
    'microsoft/DialoGPT-large',
    'gpt2',
    'distilgpt2',
    'bigcode/starcoder',
    'bigcode/starcoder2-3b'
];
