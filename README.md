# WhatsApp Web AI Assistant

[![CI](https://github.com/silham/WhatsApp-Web-AI-Assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/silham/WhatsApp-Web-AI-Assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4.svg)](manifest.json)

A Chrome extension that enables you to export WhatsApp Web conversations and generate AI responses using the language model of your choice.

It runs entirely in your own browser: there is no server, no telemetry, and
conversation text leaves your machine only when you explicitly ask for an AI
response — and then only to the provider you picked. You bring your own API key.

> **Not affiliated with WhatsApp or Meta.** See [Disclaimer](#disclaimer).

## Features

- 📤 **Export Conversations**: Extract and download complete WhatsApp conversations as text files
- 🤖 **AI Response Generation**: Generate contextually appropriate responses from the conversation's context
- 🔌 **Bring Your Own Model**: Gemini, Claude, GPT, OpenRouter, Groq, DeepSeek, Mistral, Grok, a local Ollama, or any OpenAI-compatible endpoint
- ⚙️ **Custom System Instructions**: Personalize AI behavior with custom instructions and presets
- ✨ **Smart Integration**: Insert AI-generated responses directly into WhatsApp's message input
- 📋 **Copy to Clipboard**: Easily copy generated responses for use elsewhere
- 🌐 **Your Language**: Read the extension in English or Tamil, and have the AI reply in any of thirteen languages - the two are set independently
- 🔒 **Privacy-Focused**: All processing happens locally in your browser

## Installation

1. **Download or Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in the top-right corner)
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

## Setup

1. **Get an API Key** from whichever provider you want to use — see
   [Supported providers](#supported-providers) for the links. Most offer a free
   tier, and a local Ollama needs no key at all.

2. **Configure the Extension**:
   - Open [WhatsApp Web](https://web.whatsapp.com)
   - Look for the green floating AI button (bottom-right corner)
   - Click the button and select "Settings"
   - Pick your provider, paste its API key, and save
   - Optionally set a model (leave blank for the provider's default, or press
     **Load models from provider** to see what your key can actually reach)
   - Optionally customize the system instructions to personalize AI responses

Keys are kept per provider, so you can switch between them without pasting a
key again.

## Supported providers

| Provider | Default model | Where to get a key |
| --- | --- | --- |
| Google Gemini | `gemini-3.5-flash` | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| Anthropic Claude | `claude-sonnet-5` | [Anthropic Console](https://console.anthropic.com/settings/keys) |
| OpenAI | `gpt-4o-mini` | [OpenAI dashboard](https://platform.openai.com/api-keys) |
| OpenRouter | `openai/gpt-4o-mini` | [OpenRouter keys](https://openrouter.ai/keys) |
| Groq | `llama-3.3-70b-versatile` | [Groq console](https://console.groq.com/keys) |
| DeepSeek | `deepseek-chat` | [DeepSeek platform](https://platform.deepseek.com/api_keys) |
| Mistral AI | `mistral-small-latest` | [Mistral console](https://console.mistral.ai/api-keys) |
| xAI Grok | `grok-3` | [xAI console](https://console.x.ai/) |
| Ollama (local) | `llama3.1` | No key needed |
| Custom (OpenAI-compatible) | — | Your own endpoint |

**Custom** covers anything that serves `/chat/completions` — LM Studio, vLLM,
Together, Fireworks, an Azure OpenAI gateway, or your own proxy. Point the base
URL at it and the extension treats it like any other provider.

Chrome only lets the extension reach the hosts listed in `manifest.json`. A
custom endpoint or a local Ollama is not one of them, so open the extension
popup once and press **Grant access** — Chrome asks for that permission at
runtime, which it can only do from the popup.

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
   - "Reply warmly and keep it personal"
3. Use preset buttons for common instruction templates
4. Save your settings

The AI will use these instructions to tailor its responses to your needs.

### Choosing a Language

Two independent settings, both in the AI button -> Settings dialog:

- **Interface Language** - the extension's own menus, dialogs and messages.
  English and Tamil (தமிழ்) are available. Changing it redraws the interface
  straight away; nothing needs reloading. The help page has the same picker.
- **Reply Language** - the language the AI drafts replies in, whatever language
  the chat itself is in. Leave it on **Auto** to follow the conversation, or
  pin it to Tamil, English, Sinhala, Hindi, Arabic, Spanish, French, German,
  Portuguese, Russian, Chinese or Japanese.

Prefer the Reply Language setting over asking for a language in the System
Instructions box: it is appended to the system prompt last, so it wins over
anything in the custom instructions that says otherwise.

Adding a language means adding one entry to `MESSAGES` in
[`lib/i18n.js`](lib/i18n.js) - the test suite checks that every locale defines
the same keys, with the same placeholders, as English.

## How It Works

The extension uses advanced DOM selectors to extract messages from WhatsApp Web:

- **Incoming messages**: Detected using `.message-in` class
- **Outgoing messages**: Detected using `.message-out` class
- **Message content**: Extracted from `.selectable-text` elements
- **Timestamps**: Retrieved from message metadata
- **Group chat senders**: Identified from message attributes

The conversation is then formatted and sent to your chosen provider to generate
contextually appropriate responses.

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
- **Provider**: any of the [supported providers](#supported-providers), chosen in settings
- **Temperature**: 0.7 (balanced creativity)
- **Max Tokens**: 1024
- **Context**: up to the 100 most recent messages

Requests are made from the background service worker rather than the content
script. A content script's `fetch` is an ordinary cross-origin request from
`web.whatsapp.com`, so it only reaches providers that happen to send permissive
CORS headers; from the worker it is covered by the manifest's host permissions
and works everywhere.

### Supported Features
- ✅ Text messages
- ✅ Group chats
- ✅ Individual chats
- ✅ Message timestamps
- ✅ Sender identification
- ⚠️ Media messages (Will be available soon)

## Privacy & Security

- All message processing happens locally in your browser
- API keys are stored in Chrome's sync storage, one per provider
- Conversations are only sent to your chosen provider, and only when you explicitly request an AI response
- No data is stored on external servers (except during API calls)
- Extension only works on `web.whatsapp.com` for security

## File Structure

```
WhatsApp-Web-AI-Assistant/
├── manifest.json          # Extension configuration (Manifest V3)
├── content.js             # WhatsApp integration: DOM scraping, cache, UI, settings
├── background.js          # Service worker; performs every provider call, injects the content script
├── popup.html/.js         # Toolbar popup; grants access to custom endpoints
├── help.html              # In-extension documentation page
├── styles.css             # Styling for the injected UI
├── lib/
│   ├── providers.js       # One adapter per provider: request, response, errors
│   ├── settings.js        # Storage layout and the upgrade from the old Gemini-only key
│   └── timestamps.js      # Dependency-free timestamp parsing and message ordering
├── test/                  # Unit tests for lib/, run with `node --test`
├── scripts/
│   ├── check-manifest.js  # Validates manifest.json before packaging
│   └── package.js         # Builds the Chrome Web Store zip into dist/
└── .github/workflows/     # CI and release automation
```

Anything that can be tested without a browser lives in `lib/`. Files there
attach their API to `globalThis` for the extension and export it via CommonJS
for the tests, so a single file serves both.

## Development

### Prerequisites
- Chrome browser
- [Node.js](https://nodejs.org) 20.11 or newer (for linting, tests and packaging)
- An API key from one of the [supported providers](#supported-providers)

### Local Development
```bash
git clone https://github.com/silham/WhatsApp-Web-AI-Assistant.git
cd WhatsApp-Web-AI-Assistant
npm install          # ESLint only; the extension itself ships no dependencies
npm run verify       # lint + manifest check + tests
```

Then load the folder in Chrome via **Load unpacked**, as in
[Installation](#installation). After editing a file, press reload on the
extension card in `chrome://extensions/` and refresh the WhatsApp Web tab —
content scripts are not hot-reloaded.

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint across the extension, scripts and tests |
| `npm test` | Unit tests for `lib/`, using Node's built-in runner |
| `npm run check:manifest` | Validates `manifest.json` and its version against `package.json` |
| `npm run verify` | All three, the same set CI runs |
| `npm run package` | Verifies, then builds `dist/*.zip` for the Chrome Web Store |

### Key Components

**content.js**: Main script that:
- Detects WhatsApp messages using CSS selectors
- Extracts conversation data
- Renders the settings and response UI
- Asks the background worker for a generation

**lib/providers.js**: One adapter per provider. Each knows how to turn a prompt
into an HTTP request, how to find the text in the response, and how to explain
an error. Adding a provider means adding an entry here — nothing else in the
extension names a vendor. Most vendors speak the OpenAI chat-completions
dialect and share one builder, so an OpenAI-compatible provider is a few lines.

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
- Verify the API key is correct for the provider selected in settings
- Press **Test Connection** in settings — it reports the provider's own error
- If the model name is wrong you will see a 404; leave it blank for the default,
  or press **Load models from provider**
- For a custom or local endpoint, open the popup and grant access to its host
- Check internet connection and that you haven't exceeded the provider's limits

### Messages Not Extracting
- Make sure conversation is fully loaded
- Scroll up to load older messages
- Try refreshing the page

## API Rate Limits

Every provider sets its own rate limits and pricing; check your provider's
dashboard. Rate-limit responses (HTTP 429) are surfaced as a notification with
the provider's own message.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the
setup, the checks to run before opening a pull request, and where code should
live. Participation is governed by our
[Code of Conduct](CODE_OF_CONDUCT.md).

**Never include real conversation content** in an issue, a pull request or a
test fixture — exports contain private messages, phone numbers and sometimes
one-time passcodes.

Changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## Security

To report a vulnerability, use
[private vulnerability reporting](https://github.com/silham/WhatsApp-Web-AI-Assistant/security/advisories/new)
rather than a public issue. [SECURITY.md](SECURITY.md) sets out what is in
scope and exactly what the extension does with your data.

## License

[MIT](LICENSE) © Shakil Ilham

## Disclaimer

This extension is not affiliated with WhatsApp or Meta. It's an independent tool designed to enhance the WhatsApp Web experience through AI integration.

## Support

- [Open an issue](https://github.com/silham/WhatsApp-Web-AI-Assistant/issues/new/choose) for a bug or a feature request
- Review the [troubleshooting](#troubleshooting) section above
- Open `help.html` from the extension popup for in-app documentation
- For anything security-related, see [SECURITY.md](SECURITY.md)

---

**Note**: This extension requires an API key from one of the supported providers
(or a local Ollama) to function. Make sure to keep your API key secure and never
share it publicly.
