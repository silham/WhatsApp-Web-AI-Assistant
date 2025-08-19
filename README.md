# WhatsApp Web AI Assistant

A Chrome extension that enables you to export WhatsApp Web conversations and generate AI responses using Google's Gemini AI.

## Features

- 📤 **Export Conversations**: Extract and download complete WhatsApp conversations as text files
- 🤖 **AI Response Generation**: Generate contextually appropriate responses using Google's Gemini AI
- ⚙️ **Custom System Instructions**: Personalize AI behavior with custom instructions and presets
- ✨ **Smart Integration**: Insert AI-generated responses directly into WhatsApp's message input
- 📋 **Copy to Clipboard**: Easily copy generated responses for use elsewhere
- 🔒 **Privacy-Focused**: All processing happens locally in your browser

## Installation

1. **Download or Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in the top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

## Setup

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Create a new API key (free tier available)

2. **Configure the Extension**:
   - Open [WhatsApp Web](https://web.whatsapp.com)
   - Look for the green floating AI button (bottom-right corner)
   - Click the button and select "Settings"
   - Enter your Gemini API key and save
   - Optionally customize the system instructions to personalize AI responses

## Usage

### Exporting Conversations

1. Open any WhatsApp conversation
2. Click the floating AI button
3. Select "Export Conversation"
4. The conversation will be downloaded as a text file

### Generating AI Responses

1. Make sure your API key is configured
2. Open any WhatsApp conversation
3. Click the floating AI button
4. Select "Generate AI Response"
5. Wait for the AI to analyze and generate a response
6. Choose to copy or insert the response directly into the chat

### Customizing AI Behavior

1. Click the AI button and go to Settings
2. In the "System Instructions" field, enter custom instructions such as:
   - "Always respond in a professional manner"
   - "Keep responses brief and to the point"  
   - "Act as a customer support agent"
   - "Respond in Spanish with enthusiasm"
3. Use preset buttons for common instruction templates
4. Save your settings

The AI will use these instructions to tailor its responses to your needs.

## How It Works

The extension uses advanced DOM selectors to extract messages from WhatsApp Web:

- **Incoming messages**: Detected using `.message-in` class
- **Outgoing messages**: Detected using `.message-out` class
- **Message content**: Extracted from `.selectable-text` elements
- **Timestamps**: Retrieved from message metadata
- **Group chat senders**: Identified from message attributes

The conversation is then formatted and sent to Google's Gemini AI API to generate contextually appropriate responses.

## Technical Details

### Message Detection
```javascript
// Incoming messages (like your HTML example)
document.querySelectorAll('.message-in')

// Outgoing messages
document.querySelectorAll('.message-out')

// Message containers
document.querySelectorAll('[data-testid="msg-container"]')
```

### AI Integration
- **Model**: Gemini Pro
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: 1024
- **Context**: Full conversation history

### Supported Features
- ✅ Text messages
- ✅ Group chats
- ✅ Individual chats
- ✅ Message timestamps
- ✅ Sender identification
- ⚠️ Media messages (text extraction only)

## Privacy & Security

- All message processing happens locally in your browser
- API key is stored securely in Chrome's sync storage
- Conversations are only sent to Gemini when you explicitly request AI responses
- No data is stored on external servers (except during API calls)
- Extension only works on `web.whatsapp.com` for security

## File Structure

```
whatsapp-web-ai/
├── manifest.json          # Extension configuration
├── content.js             # Main functionality and WhatsApp integration
├── styles.css             # UI styling
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── background.js          # Service worker
├── help.html              # Documentation page
└── README.md              # This file
```

## Development

### Prerequisites
- Chrome browser
- Basic knowledge of JavaScript/HTML/CSS
- Gemini API key

### Local Development
1. Clone the repository
2. Make changes to the source files
3. Reload the extension in `chrome://extensions/`
4. Test on WhatsApp Web

### Key Components

**content.js**: Main script that:
- Detects WhatsApp messages using CSS selectors
- Extracts conversation data
- Interfaces with Gemini AI API
- Manages UI interactions

**styles.css**: Provides styling for:
- Floating action button
- Modal dialogs
- Responsive design
- Notification system

## Troubleshooting

### Extension Not Working
- Refresh WhatsApp Web page
- Check if extension is enabled in Chrome
- Verify you're on `web.whatsapp.com`

### AI Responses Not Generating
- Verify API key is correctly entered
- Check internet connection
- Ensure you haven't exceeded API limits

### Messages Not Extracting
- Make sure conversation is fully loaded
- Scroll up to load older messages
- Try refreshing the page

## API Rate Limits

Google's Gemini API has rate limits:
- **Free tier**: 60 requests per minute
- **Paid tier**: Higher limits available

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on WhatsApp Web
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Disclaimer

This extension is not affiliated with WhatsApp or Meta. It's an independent tool designed to enhance the WhatsApp Web experience through AI integration.

## Support

For issues, suggestions, or questions:
- Open an issue in the GitHub repository
- Check the help.html file for detailed documentation
- Review the troubleshooting section above

---

**Note**: This extension requires a Google Gemini API key to function. Make sure to keep your API key secure and never share it publicly.
