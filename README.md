# MiniBot - Your AI-Powered Chrome Extension

MiniBot is a Chrome extension that integrates with Google's Gemini AI to provide contextual assistance while browsing. It reads and understands the content of your current webpage and can answer questions based on that context.

## Features

- 🤖 AI-powered contextual chat using Google's Gemini API
- 💬 Persistent chat history across browsing sessions
- 🎯 Context-aware responses based on current webpage content
- 📦 Chunks to handle large contexts
- 🔄 Vector embeddings for improved context understanding
- 📝 Markdown support for bot responses including:
  - Code blocks with syntax highlighting
  - Lists (ordered and unordered)
  - Inline code formatting
- 📋 One-click code copying from bot responses
- 🎨 Clean and minimalistic UI that doesn't interfere with browsing

## Limitations

- Currently requires a local FastAPI server running for backend operations
- Requires Google's Gemini API key for operation
- Works best with text-based content pages
- Local server needs to be running on port 8000
- Can get context only from the current page, can't crawl through sub pages/links

## Installation

### Prerequisites

- Python 3.8 or higher
- Google Chrome browser
- Gemini API key

### Server Setup

1. Clone the repository:
```bash
git clone https://github.com/Turza39/your-bot-extension.git
cd your-bot-extension
```

2. Create and activate a virtual environment:
```bash
# On Windows
python -m venv venv
.\venv\Scripts\activate

# On macOS/Linux
python -m venv venv
source venv/bin/activate
```

3. Install required Python packages:
```bash
cd server
pip install fastapi uvicorn google-generativeai python-dotenv faiss-cpu numpy
```

4. Start the FastAPI server:
```bash
python functions.py
```

5. On first use, the extension will prompt you to enter your Gemini API key. This key will be securely stored in your browser and can be updated any time through the extension interface.
```bash
python functions.py
```

### Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension directory
4. The MiniBot icon should appear in your Chrome toolbar

## Usage

1. Click the MiniBot icon in your toolbar to open the chat interface
2. Type your question about the current webpage
3. MiniBot will respond based on the page content and context
4. Code snippets can be copied using the copy button
5. Chat history is saved between sessions until you explicitly clear it

## Development

### Technical Details

- Backend: FastAPI with Google's Gemini API
- Frontend: Vanilla JavaScript
- Storage: Chrome's local storage API
- Vector Store: FAISS for embeddings
- UI Framework: Custom CSS with minimal dependencies

### Project Structure

```
bot-extension/
├── background.js
├── bot-icon.png
├── ChatGPT-bot-icon.png
├── content.js
├── inject.css
├── inject.html
├── inject.js
├── LICENSE
├── manifest.json
├── marked.min.js
├── options.html
├── popup.html
├── popup.js
├── README.md
├── requirements.txt
└── server/
    └── functions.py
```

### Key Components

- `functions.py`: FastAPI server handling embeddings and AI responses
- `background.js`: Chrome extension background script for API communication
- `inject.js`: Content script for UI and interaction handling
- `inject.html`: Chat interface template

### Local Development

1. Make changes to the extension files
2. Reload the extension in `chrome://extensions/`
3. For server changes, restart the FastAPI server

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google's Gemini API for AI capabilities
- FastAPI for the backend framework
- FAISS for vector similarity search
- Chrome Extensions API
