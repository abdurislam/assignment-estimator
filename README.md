# 📚 Assignment Time Estimator Chrome Extension

A Chrome extension that analyzes Canvas assignments and uses AI to estimate completion time, helping students better plan their workload.

## 🚀 Features

- **Canvas Integration**: Automatically extracts assignment details from Canvas pages
- **AI-Powered Estimation**: Uses OpenAI's GPT models to provide intelligent time estimates
- **Fallback Logic**: Works even without API key using rule-based estimation
- **Multiple Canvas Views**: Supports assignments list, modules, and syllabus views
- **Time Aggregation**: Shows total estimated time for all assignments

## 📋 Installation

### Option 1: Load Unpacked Extension (Development)

1. **Download/Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top right)
4. **Click "Load unpacked"** and select the `assignment-estimator` folder
5. **Pin the extension** to your toolbar for easy access

### Option 2: Create Extension Icons (Optional)

The extension will work without custom icons, but you can create them:
- Create 16x16, 48x48, and 128x128 pixel PNG files
- Name them `icon16.png`, `icon48.png`, `icon128.png`
- Place them in the `icons/` folder

## ⚙️ Setup

### 1. Configure OpenAI API (Recommended)

1. **Get an OpenAI API key** from [OpenAI's website](https://platform.openai.com/api-keys)
2. **Click the extension icon** in Chrome
3. **Click "Configure API Settings"**
4. **Enter your API key** and select a model
5. **Test the connection** to verify it works

### 2. Alternative: Use Without API Key

The extension includes fallback estimation that works without an API key, using rule-based logic based on assignment type, title keywords, and point values.

## 🎯 Usage

1. **Navigate to Canvas** - Go to any Canvas course page with assignments
2. **Open the extension** - Click the extension icon in your browser toolbar
3. **Analyze assignments** - Click "Analyze Canvas Assignments"
4. **View estimates** - See time estimates for each assignment and total time

### Supported Canvas Pages:
- Assignment list (`/courses/{id}/assignments`)
- Course modules (`/courses/{id}/modules`)
- Course syllabus (`/courses/{id}/assignments/syllabus`)

## 🔧 Technical Details

### File Structure
```
assignment-estimator/
├── manifest.json          # Extension configuration
├── popup.html/js          # Main interface
├── content.js             # Canvas page integration
├── background.js          # LLM API handling
├── options.html/js        # Settings page
├── styles.css             # Content script styles
└── icons/                 # Extension icons
```

### Key Components

- **Content Script**: Extracts assignment data from Canvas DOM
- **Background Script**: Handles OpenAI API calls and fallback estimation
- **Popup Interface**: User-friendly interface for triggering analysis
- **Options Page**: Configuration for API settings

### AI Estimation Logic

The extension uses a sophisticated prompt that considers:
- Assignment title and type
- Point values
- Due dates
- Assignment descriptions
- Keywords indicating complexity

### Fallback Estimation

When no API key is configured, uses rule-based estimation:
- Base time by assignment type (essay: 3h, quiz: 0.5h, etc.)
- Adjustments for point values
- Keyword analysis (final, major, quick, etc.)

## 🔒 Privacy & Security

- **API keys stored locally** in Chrome's secure storage
- **No data collection** - all processing happens locally
- **Canvas permissions** only used for reading assignment data
- **API calls** made directly from your browser to OpenAI

## 🐛 Troubleshooting

### "Docker is not running" Error
This error is from the old Docker setup - ignore it. The Chrome extension doesn't need Docker.

### "No assignments found"
- Make sure you're on a Canvas course page
- Try different Canvas views (assignments, modules, syllabus)
- Check browser console for detailed error messages

### API Connection Issues
- Verify your OpenAI API key is correct
- Check that you have API credits available
- Test the connection in the settings page

### Canvas Access Issues
- Make sure the extension has permissions for your Canvas domain
- Try refreshing the Canvas page before running analysis

## 🚀 Future Enhancements

- **Calendar Integration**: Export estimates to Google Calendar
- **Progress Tracking**: Track actual time vs estimates
- **Canvas API Integration**: Direct API access for more detailed assignment info
- **Multiple LLM Support**: Support for Anthropic Claude, local models
- **Study Planning**: Suggest optimal assignment scheduling

## 🤝 Contributing

This is a development project. Feel free to:
- Report bugs or issues
- Suggest new features
- Submit pull requests
- Improve the Canvas parsing logic

## 📄 License

MIT License - feel free to modify and distribute as needed.

Token: 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
gemini: AIzaSyCBR68peIcap4N6LxWviHIRh3CNj5E6SYU