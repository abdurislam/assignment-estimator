# Assignment Time Estimator Chrome Extension

A Chrome extension that analyzes Canvas assignments and uses AI to estimate completion time, helping students better plan their workload.

## Features

- **Canvas Integration**: Automatically extracts assignment details from Canvas pages
- **Multiple AI Providers**: Supports Ollama (local), Google AI, Hugging Face, and OpenAI
- **Week-by-Week View**: Visual breakdown of workload by week with charts
- **Fallback Logic**: Works even without API using rule-based estimation
- **Multiple Canvas Views**: Supports dashboard, assignments, modules, and syllabus
- **Time Aggregation**: Shows total estimated time and per-week breakdown

## Installation

### Load Unpacked Extension (Development)

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top right)
4. **Click "Load unpacked"** and select the project folder
5. **Pin the extension** to your toolbar for easy access

## Setup

### Option 1: Ollama (Recommended - Free & Private)

1. **Install Ollama** from [ollama.ai](https://ollama.ai)
2. **Pull a model**: `ollama pull llama3.1:8b`
3. **Start Ollama**: `ollama serve`
4. **Enable CORS** (if needed): `OLLAMA_ORIGINS="*" ollama serve`
5. The extension defaults to Ollama - no additional config needed!

### Option 2: Google AI (Free Cloud)

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click the extension icon → Settings
3. Select Google AI tab, enter your API key

### Option 3: OpenAI (Paid)

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Click the extension icon → Settings
3. Select OpenAI tab, enter your API key

### Option 4: No API (Fallback)

Works without any API using rule-based estimation based on assignment type and keywords.

## Usage

1. **Navigate to Canvas** - Go to any Canvas page
2. **Open the extension** - Click the extension icon
3. **Analyze assignments** - Click the analyze button
4. **View estimates** - See weekly breakdown, charts, and total time

### Supported Canvas Pages
- Dashboard (upcoming assignments)
- Assignment list (`/courses/{id}/assignments`)
- Course modules (`/courses/{id}/modules`)
- Individual assignment pages

## Architecture

```
assignment-estimator/
├── manifest.json           # Extension configuration
├── background.js           # LLM API handling & estimation service
├── content.js              # Canvas DOM extraction
├── popup.html/js           # Main popup interface
├── options.html/js         # Settings page
├── styles.css              # Content script styles
├── icons/                  # Extension icons
└── src/                    # Modular source code (reference)
    ├── utils/              # Shared utilities
    │   ├── constants.js    # Configuration constants
    │   ├── helpers.js      # Helper functions
    │   └── storage.js      # Chrome storage utilities
    ├── providers/          # LLM provider implementations
    │   ├── base.js         # Base provider class
    │   ├── ollama.js       # Ollama provider
    │   ├── huggingface.js  # Hugging Face provider
    │   ├── google.js       # Google AI provider
    │   ├── openai.js       # OpenAI provider
    │   └── index.js        # Provider factory
    ├── services/           # Business logic
    │   ├── estimation-service.js
    │   └── fallback-estimator.js
    ├── extractors/         # Canvas data extraction
    │   └── canvas-extractor.js
    └── ui/                 # UI components
        ├── weekly-grouper.js
        └── chart-renderer.js
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `background.js` | Service worker handling LLM API calls |
| `content.js` | Canvas page DOM scraping and extraction |
| `popup.js` | UI logic, weekly grouping, and chart rendering |
| `options.js` | Settings management for all providers |

### Estimation Flow

1. **Extract**: Content script scrapes Canvas page for assignments
2. **Analyze**: Background script sends data to configured LLM
3. **Fallback**: If LLM fails, uses keyword-based estimation
4. **Display**: Popup groups by week and renders charts

## Privacy & Security

- **Local-first**: Ollama runs entirely on your machine
- **API keys stored locally** in Chrome's secure storage
- **No data collection** - all processing is local or direct to chosen API
- **Canvas permissions** only for reading assignment data

## Troubleshooting

### Ollama Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start with CORS enabled
OLLAMA_ORIGINS="*" ollama serve

# For snap installations
sudo systemctl edit snap.ollama.ollama.service
# Add: Environment="OLLAMA_ORIGINS=*"
sudo snap restart ollama
```

## Contributing

Contributions welcome! Feel free to:
- Report bugs or issues
- Suggest new features
- Submit pull requests
- Improve Canvas parsing logic

## License

MIT License - feel free to modify and distribute as needed.
