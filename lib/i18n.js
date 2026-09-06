/**
 * The extension's own interface strings, in every language it speaks.
 *
 * Deliberately not chrome.i18n/_locales: that picks a locale from the browser's
 * UI language and cannot be changed at runtime, so a user on an English Chrome
 * could never switch this extension to Tamil. Only the manifest fields - which
 * Chrome itself renders, out of reach of any script - stay in _locales/.
 *
 * The chosen locale rides in chrome.storage.sync next to the provider settings
 * (see lib/settings.js), so it follows the user across their signed-in Chromes.
 *
 * Shared by the content script, the popup, the help page and the tests.
 */
(function (root, factory) {
  const api = factory(root);

  if (root) {
    root.I18n = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_LOCALE = 'en';

  /** Offered in the interface-language picker. `native` is what the user reads. */
  const LOCALES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' }
  ];

  /**
   * Languages the AI can be told to reply in. Separate from the interface
   * locale on purpose: reading the menus in Tamil and drafting replies in
   * English is a normal thing to want.
   *
   * `prompt` is the English name the model is given - model instructions are
   * most reliable in English even when the requested output is not.
   */
  const REPLY_LANGUAGES = [
    { code: 'auto', prompt: '' },
    { code: 'ta', prompt: 'Tamil', native: 'தமிழ்' },
    { code: 'en', prompt: 'English', native: 'English' },
    { code: 'si', prompt: 'Sinhala', native: 'සිංහල' },
    { code: 'hi', prompt: 'Hindi', native: 'हिन्दी' },
    { code: 'ar', prompt: 'Arabic', native: 'العربية' },
    { code: 'es', prompt: 'Spanish', native: 'Español' },
    { code: 'fr', prompt: 'French', native: 'Français' },
    { code: 'de', prompt: 'German', native: 'Deutsch' },
    { code: 'pt', prompt: 'Portuguese', native: 'Português' },
    { code: 'ru', prompt: 'Russian', native: 'Русский' },
    { code: 'zh', prompt: 'Chinese', native: '中文' },
    { code: 'ja', prompt: 'Japanese', native: '日本語' }
  ];

  const MESSAGES = {
    en: {
      'app.name': 'WhatsApp AI Assistant',

      // Popup
      'popup.subtitle': 'Export & Generate AI Responses',
      'popup.feature.export': 'Export full conversations',
      'popup.feature.generate': 'Generate AI responses with any provider',
      'popup.feature.insert': 'Auto-insert responses',
      'popup.feature.copy': 'Copy to clipboard',
      'popup.grantAccess': 'Grant access',
      'popup.openWhatsApp': 'Open WhatsApp Web',
      'popup.configureSettings': 'Configure Settings',
      'popup.viewHelp': 'View Help',
      'popup.whatsappActive': 'WhatsApp Web Active',
      'popup.extensionActive': 'Extension is active on WhatsApp Web',
      'popup.refreshing': 'Refreshing WhatsApp Web...',
      'popup.opening': 'Opening WhatsApp Web...',
      'popup.refreshFirst': 'Please refresh WhatsApp Web first',
      'popup.openingSettings': 'Opening settings...',
      'popup.openFirst': 'Please open WhatsApp Web first',
      'popup.using': 'Using {provider}',
      'popup.defaultModel': 'default model',
      'popup.badBaseUrl': 'Base URL is not a valid URL - fix it in settings.',
      'popup.permissionNeeded':
        'Chrome needs your permission before the extension can reach {host}.',
      'popup.accessGranted': 'Access granted',
      'popup.accessDenied': 'Access denied - the provider cannot be reached',

      // Floating button and its menu
      'fab.title': 'AI Assistant',
      'fab.titleCached': 'AI Assistant ({count} cached)',
      'menu.export': '📤 Export Conversation',
      'menu.generate': '🤖 Generate AI Response',
      'menu.history': '📜 Load Full History',
      'menu.clearCache': '🗑️ Clear Cache',
      'menu.settings': '⚙️ Settings',

      // Notifications
      'notify.activated': 'WhatsApp AI Assistant activated!',
      'notify.loadingHistory': 'Loading full conversation history...',
      'notify.loadingProgress': 'Loading... {count} messages found',
      'notify.loadedMessages': 'Loaded {count} messages from conversation',
      'notify.historyLoaded':
        'Loaded {count} messages. Cache updated with full conversation history.',
      'notify.historyFailed': 'Failed to load full conversation history',
      'notify.cacheCleared': 'Message cache cleared',
      'notify.cacheClearFailed': 'Failed to clear cache',
      'notify.collecting': 'Collecting conversation messages...',
      'notify.exported': 'Conversation exported successfully! ({count} messages)',
      'notify.exportFailed': 'Failed to export conversation',
      'notify.openingSettings': '{message}. Opening settings...',
      'notify.needsBaseUrl': '{provider} needs a base URL. Opening settings...',
      'notify.blockedHost':
        'Chrome is blocking {host}. Open the extension popup and grant access to it.',
      'notify.blockedHostShort':
        'Chrome is blocking {host}. Open the extension popup to grant access.',
      'notify.analyzing': 'Analyzing conversation...',
      'notify.noMessages': 'No messages found to analyze',
      'notify.generatingWith': 'Generating with {provider}...',
      'notify.generated': 'AI response generated successfully!',
      'notify.generateFailed': 'Failed to generate AI response',
      'notify.copied': 'Response copied to clipboard!',
      'notify.inserted': 'Response inserted into chat input',
      'notify.noInput': 'Could not find message input field',
      'notify.needBaseUrlFirst': 'Enter a base URL first',
      'notify.loadingModels': 'Loading models...',
      'notify.modelsFailed': 'Could not load models: {error}',
      'notify.noModels': 'The provider listed no models',
      'notify.modelsLoaded': 'Loaded {count} models - click the model box to pick one',
      'notify.noResponse': 'no response',
      'notify.testing': 'Testing {provider}...',
      'notify.testOk': '{provider} responded - connection works',
      'notify.testFailed': 'Test failed: no response',
      'notify.savedNeedsPermission':
        'Saved. Open the extension popup to let Chrome reach {host}.',
      'notify.saved': 'Settings saved successfully!',

      // Instructions dialog
      'instructions.title': 'Instructions for Next Message',
      'instructions.body':
        'Provide specific instructions for how the AI should respond to this conversation (optional):',
      'instructions.placeholder':
        'Example: Be more formal, focus on technical details, be encouraging, etc.',
      'instructions.skip': 'Skip',
      'instructions.apply': 'Apply Instructions',

      // Response dialog
      'response.title': 'AI Generated Response',
      'response.copy': 'Copy to Clipboard',
      'response.insert': 'Insert into Chat',

      // Settings dialog
      'settings.title': 'AI Assistant Settings',
      'settings.provider': 'AI Provider:',
      'settings.apiKey': 'API Key:',
      'settings.apiKeyPlaceholder': 'Your API key',
      'settings.model': 'Model:',
      'settings.modelPlaceholder': 'Model name',
      'settings.modelHint': "Leave blank to use the provider's default.",
      'settings.loadModels': 'Load models from provider',
      'settings.baseUrl': 'API Base URL:',
      'settings.baseUrlHint': 'Leave blank for {url}',
      'settings.baseUrlHintCustom':
        'Point this at any endpoint that serves /chat/completions.',
      'settings.noKeyNeeded': 'This provider works without a key.',
      'settings.keyDocs': 'Create a key at <a href="{url}" target="_blank" rel="noopener">{label}</a>',
      'settings.keyPrefix': ', it starts with "{prefix}".',
      'settings.keyStorage':
        'Keys are stored in your browser profile and are only ever sent to the provider you pick.',
      'settings.uiLanguage': 'Interface Language:',
      'settings.uiLanguageHint':
        'Changes the extension\'s own menus and messages. Takes effect right away.',
      'settings.replyLanguage': 'Reply Language:',
      'settings.replyLanguageAuto': 'Auto - match the conversation',
      'settings.replyLanguageHint':
        'The language the AI drafts replies in, whatever language the chat is in.',
      'settings.systemInstructions': 'System Instructions:',
      'settings.systemInstructionsPlaceholder': 'Enter custom instructions for the AI...',
      'settings.instructionsLead': 'Instructions for the AI:',
      'settings.instructionsBody':
        'Define how the AI should behave, its personality, tone, or specific guidelines.',
      'settings.examplesLead': 'Examples:',
      'settings.example1': 'Always respond in a friendly and professional manner',
      'settings.example2': 'Keep responses brief and to the point',
      'settings.example3': 'Act as a customer support agent for my business',
      'settings.example4': 'Reply in Tamil and be very warm',
      'settings.presetsSummary': '🎯 Preset Instructions (Click to expand)',
      'settings.preset.professional': '👔 Professional',
      'settings.preset.friendly': '😊 Friendly',
      'settings.preset.brief': '⚡ Brief',
      'settings.preset.creative': '🎨 Creative',
      'settings.preset.support': '🛠️ Support Agent',
      'settings.preset.translator': '🌐 Translator',
      'settings.testLabel': 'Test API Connection:',
      'settings.test': 'Test Connection',
      'settings.save': 'Save Settings',

      // Help page
      'help.pageTitle': 'WhatsApp AI Assistant - Help',
      'help.subtitle': 'Complete Guide & Documentation',
      'help.languageLabel': 'Language:',

      'help.start.title': '🚀 Getting Started',
      'help.start.1.lead': 'Install the Extension:',
      'help.start.1.body':
        'Load the extension in Chrome by going to chrome://extensions/, enabling Developer mode, and clicking "Load unpacked" to select the extension folder.',
      'help.start.2.lead': 'Get an API Key:',
      'help.start.2.body':
        'Pick a provider and create a key — see <a href="#providers">Supported providers</a> below. Most have a free tier, and a local Ollama needs no key at all.',
      'help.start.3.lead': 'Open WhatsApp Web:',
      'help.start.3.body':
        'Navigate to <a href="https://web.whatsapp.com" target="_blank">web.whatsapp.com</a> and scan the QR code to log in.',
      'help.start.4.lead': 'Configure Settings:',
      'help.start.4.body':
        'Click the floating AI button and go to Settings to pick your provider and paste its API key.',

      'help.features.title': '✨ Features',
      'help.features.export.title': 'Export Conversations',
      'help.features.export.body':
        'Extract and download complete WhatsApp conversations as text files for backup or analysis.',
      'help.features.generate.title': 'AI Response Generation',
      'help.features.generate.body':
        'Generate contextually appropriate responses from the conversation history, using the AI provider of your choice.',
      'help.features.insert.title': 'Smart Integration',
      'help.features.insert.body':
        "Seamlessly insert AI-generated responses directly into WhatsApp's message input field.",
      'help.features.copy.title': 'Copy to Clipboard',
      'help.features.copy.body':
        'Easily copy generated responses to use in other applications or modify before sending.',
      'help.features.language.title': 'Your Language',
      'help.features.language.body':
        'Read the extension in English or Tamil, and have the AI draft its replies in any language you pick - independently of the interface.',

      'help.howTo.title': '📖 How to Use',
      'help.howTo.export.title': 'Exporting Conversations',
      'help.howTo.export.1': 'Open any WhatsApp conversation',
      'help.howTo.export.2': 'Click the green floating AI button (bottom-right corner)',
      'help.howTo.export.3': 'Select "Export Conversation"',
      'help.howTo.export.4': 'The conversation will be downloaded as a text file',
      'help.howTo.generate.title': 'Generating AI Responses',
      'help.howTo.generate.1': "Make sure you've configured a provider and its API key",
      'help.howTo.generate.2': 'Open any WhatsApp conversation',
      'help.howTo.generate.3': 'Click the floating AI button',
      'help.howTo.generate.4': 'Select "Generate AI Response"',
      'help.howTo.generate.5': 'Wait for the AI to analyze the conversation and generate a response',
      'help.howTo.generate.6': 'Choose to either copy the response or insert it directly into the chat',
      'help.howTo.detect.title': 'Message Detection',
      'help.howTo.detect.body':
        'The extension automatically detects both incoming and outgoing messages using these CSS selectors:',

      'help.language.title': '🌐 Language',
      'help.language.body':
        'Two separate settings, both in the AI button → Settings dialog.',
      'help.language.ui.lead': 'Interface Language:',
      'help.language.ui.body':
        'The language of the extension\'s own menus, dialogs and messages. English and Tamil are available; changing it redraws the interface immediately, no reload needed.',
      'help.language.reply.lead': 'Reply Language:',
      'help.language.reply.body':
        'The language the AI writes its drafts in. Leave it on "Auto" to follow whatever language the chat is in, or pin it to Tamil, English, Sinhala, Hindi and others to always get replies in that language, in its own script.',
      'help.language.note':
        'The two are independent: an English interface can draft Tamil replies, and a Tamil interface can draft English ones.',

      'help.providers.title': '🔌 Supported providers',
      'help.providers.body':
        'Pick one in Settings. Keys are remembered per provider, so you can switch between them without pasting a key again.',
      'help.providers.ollama': 'a model running on your own machine, no key required',
      'help.providers.custom':
        'any endpoint serving <code>/chat/completions</code>: LM Studio, vLLM, Together, Fireworks, an Azure OpenAI gateway, or your own proxy',

      'help.config.title': '⚙️ Configuration',
      'help.config.key.title': 'API Key Setup',
      'help.config.key.1': 'Create a key at your provider, from the links above',
      'help.config.key.2': 'In WhatsApp Web, click the AI button → Settings',
      'help.config.key.3': 'Choose the provider from the dropdown',
      'help.config.key.4': 'Paste your API key',
      'help.config.key.5':
        'Optionally set a model — leave it blank for the provider\'s default, or press "Load models from provider" to see what your key can reach',
      'help.config.key.6': 'Save, then use "Test Connection" to verify it works',
      'help.config.custom.title': 'Custom and local endpoints',
      'help.config.custom.1':
        'Chrome only lets the extension reach the hosts listed in its manifest. A custom endpoint or a local Ollama is not one of them, so open the extension popup once and press "Grant access" — Chrome can only ask for that permission from the popup.',
      'help.config.custom.2':
        'Running Ollama? Start it with <code>OLLAMA_ORIGINS=*</code> so it accepts the extension\'s requests.',
      'help.config.warning.lead': '⚠️ Important:',
      'help.config.warning.body':
        'Keep your API key secure and never share it publicly. The extension stores it locally in your browser.',

      'help.tech.title': '🔧 Technical Details',
      'help.tech.extract.title': 'Message Extraction',
      'help.tech.extract.body': 'The extension uses multiple selectors to reliably extract messages:',
      'help.tech.extract.1': 'Main message text',
      'help.tech.extract.2': 'Alternative text selector',
      'help.tech.extract.3': 'Message timestamps',
      'help.tech.extract.4': 'Sender information for group chats',
      'help.tech.ai.title': 'AI Integration',
      'help.tech.ai.body': 'Whichever provider you pick is called with the same generation settings:',
      'help.tech.ai.provider': 'Provider: your choice (see above)',
      'help.tech.ai.model': "Model: the provider's default, or whatever you set",
      'help.tech.ai.temperature': 'Temperature: 0.7 (balanced creativity)',
      'help.tech.ai.tokens': 'Max Output Tokens: 1024',
      'help.tech.ai.context': 'Context: up to the 100 most recent messages',
      'help.tech.ai.note':
        "Requests are made from the extension's background service worker, not from the page, so every provider is reachable regardless of its CORS policy.",
      'help.tech.supported.title': 'Supported Features',
      'help.tech.supported.1': '✅ Text messages',
      'help.tech.supported.2': '✅ Group chats',
      'help.tech.supported.3': '✅ Individual chats',
      'help.tech.supported.4': '✅ Message timestamps',
      'help.tech.supported.5': '✅ Sender identification',
      'help.tech.supported.6': '⚠️ Media messages (text extraction only)',
      'help.tech.supported.7': '❌ Voice messages',
      'help.tech.supported.8': '❌ Status updates',

      'help.trouble.title': '🐛 Troubleshooting',
      'help.trouble.notWorking.title': 'Extension Not Working',
      'help.trouble.notWorking.1': 'Refresh the WhatsApp Web page',
      'help.trouble.notWorking.2': 'Check if the extension is enabled in chrome://extensions/',
      'help.trouble.notWorking.3':
        "Make sure you're on web.whatsapp.com (not other WhatsApp versions)",
      'help.trouble.noResponse.title': 'AI Responses Not Generating',
      'help.trouble.noResponse.1': 'Verify the API key matches the provider selected in Settings',
      'help.trouble.noResponse.2':
        'Press "Test Connection" in Settings — it reports the provider\'s own error',
      'help.trouble.noResponse.3':
        'A 404 usually means the model name is wrong; clear it to use the default',
      'help.trouble.noResponse.4':
        'For a custom or local endpoint, grant access to its host from the extension popup',
      'help.trouble.noResponse.5':
        "Check your internet connection and that you haven't exceeded the provider's rate limits",
      'help.trouble.noMessages.title': 'Messages Not Extracting',
      'help.trouble.noMessages.1': 'Make sure the conversation is fully loaded',
      'help.trouble.noMessages.2': 'Scroll up to load older messages if needed',
      'help.trouble.noMessages.3': 'Refresh the page and try again',
      'help.trouble.wrongLanguage.title': 'Replies Come Back in the Wrong Language',
      'help.trouble.wrongLanguage.1':
        'Set Reply Language in Settings rather than asking for a language in the System Instructions box - the setting is applied last and wins',
      'help.trouble.wrongLanguage.2':
        'Smaller models are weaker at languages other than English; try a larger model if replies drift back',

      'help.privacy.title': '🔒 Privacy & Security',
      'help.privacy.1': 'All message processing happens locally in your browser',
      'help.privacy.2': "API keys are stored in Chrome's sync storage, one per provider",
      'help.privacy.3':
        'Conversations are only sent to the provider you selected, and only when you explicitly request an AI response',
      'help.privacy.4':
        'No data is stored on external servers (except during API calls to your provider)',
      'help.privacy.5': 'Extension only works on web.whatsapp.com for security',

      'help.versions.title': '📝 Version History',
      'help.versions.13':
        'Choose any AI provider: Gemini, Claude, GPT, OpenRouter, Groq, DeepSeek, Mistral, Grok, Ollama or a custom endpoint',
      'help.versions.10': 'Initial release with conversation export and AI response generation',

      'help.support.title': '📞 Support',
      'help.support.body':
        "For issues, suggestions, or contributions, please check the extension's documentation or create an issue in the project repository."
    },

    ta: {
      'app.name': 'WhatsApp AI உதவியாளர்',

      // Popup
      'popup.subtitle': 'உரையாடல்களை ஏற்றுமதி செய்து AI பதில்களை உருவாக்குங்கள்',
      'popup.feature.export': 'முழு உரையாடல்களையும் ஏற்றுமதி செய்யுங்கள்',
      'popup.feature.generate': 'எந்த வழங்குநரையும் கொண்டு AI பதில்களை உருவாக்குங்கள்',
      'popup.feature.insert': 'பதில்களைத் தானாகவே செருகுங்கள்',
      'popup.feature.copy': 'நகலகத்திற்கு நகலெடுங்கள்',
      'popup.grantAccess': 'அணுகலை வழங்கு',
      'popup.openWhatsApp': 'WhatsApp Web ஐத் திறக்கவும்',
      'popup.configureSettings': 'அமைப்புகளை உள்ளமைக்கவும்',
      'popup.viewHelp': 'உதவியைப் பார்க்கவும்',
      'popup.whatsappActive': 'WhatsApp Web செயலில் உள்ளது',
      'popup.extensionActive': 'நீட்டிப்பு WhatsApp Web இல் செயல்படுகிறது',
      'popup.refreshing': 'WhatsApp Web புதுப்பிக்கப்படுகிறது...',
      'popup.opening': 'WhatsApp Web திறக்கப்படுகிறது...',
      'popup.refreshFirst': 'முதலில் WhatsApp Web ஐப் புதுப்பிக்கவும்',
      'popup.openingSettings': 'அமைப்புகள் திறக்கப்படுகின்றன...',
      'popup.openFirst': 'முதலில் WhatsApp Web ஐத் திறக்கவும்',
      'popup.using': '{provider} பயன்படுத்தப்படுகிறது',
      'popup.defaultModel': 'இயல்புநிலை மாதிரி',
      'popup.badBaseUrl': 'அடிப்படை URL செல்லுபடியாகாதது - அமைப்புகளில் சரிசெய்யவும்.',
      'popup.permissionNeeded':
        'நீட்டிப்பு {host} ஐ அணுகுவதற்கு Chrome க்கு உங்கள் அனுமதி தேவை.',
      'popup.accessGranted': 'அணுகல் வழங்கப்பட்டது',
      'popup.accessDenied': 'அணுகல் மறுக்கப்பட்டது - வழங்குநரை அணுக முடியவில்லை',

      // Floating button and its menu
      'fab.title': 'AI உதவியாளர்',
      'fab.titleCached': 'AI உதவியாளர் ({count} தேக்ககத்தில்)',
      'menu.export': '📤 உரையாடலை ஏற்றுமதி செய்',
      'menu.generate': '🤖 AI பதிலை உருவாக்கு',
      'menu.history': '📜 முழு வரலாற்றையும் ஏற்று',
      'menu.clearCache': '🗑️ தேக்ககத்தை அழி',
      'menu.settings': '⚙️ அமைப்புகள்',

      // Notifications
      'notify.activated': 'WhatsApp AI உதவியாளர் செயல்படுத்தப்பட்டது!',
      'notify.loadingHistory': 'முழு உரையாடல் வரலாறும் ஏற்றப்படுகிறது...',
      'notify.loadingProgress': 'ஏற்றப்படுகிறது... {count} செய்திகள் கிடைத்தன',
      'notify.loadedMessages': 'உரையாடலிலிருந்து {count} செய்திகள் ஏற்றப்பட்டன',
      'notify.historyLoaded':
        '{count} செய்திகள் ஏற்றப்பட்டன. முழு உரையாடல் வரலாற்றுடன் தேக்ககம் புதுப்பிக்கப்பட்டது.',
      'notify.historyFailed': 'முழு உரையாடல் வரலாற்றை ஏற்ற முடியவில்லை',
      'notify.cacheCleared': 'செய்தித் தேக்ககம் அழிக்கப்பட்டது',
      'notify.cacheClearFailed': 'தேக்ககத்தை அழிக்க முடியவில்லை',
      'notify.collecting': 'உரையாடல் செய்திகள் சேகரிக்கப்படுகின்றன...',
      'notify.exported': 'உரையாடல் வெற்றிகரமாக ஏற்றுமதி செய்யப்பட்டது! ({count} செய்திகள்)',
      'notify.exportFailed': 'உரையாடலை ஏற்றுமதி செய்ய முடியவில்லை',
      'notify.openingSettings': '{message}. அமைப்புகள் திறக்கப்படுகின்றன...',
      'notify.needsBaseUrl': '{provider} க்கு அடிப்படை URL தேவை. அமைப்புகள் திறக்கப்படுகின்றன...',
      'notify.blockedHost':
        'Chrome {host} ஐத் தடுக்கிறது. நீட்டிப்புச் சாளரத்தைத் திறந்து அணுகலை வழங்கவும்.',
      'notify.blockedHostShort':
        'Chrome {host} ஐத் தடுக்கிறது. அணுகலை வழங்க நீட்டிப்புச் சாளரத்தைத் திறக்கவும்.',
      'notify.analyzing': 'உரையாடல் பகுப்பாய்வு செய்யப்படுகிறது...',
      'notify.noMessages': 'பகுப்பாய்வு செய்ய செய்திகள் எதுவும் இல்லை',
      'notify.generatingWith': '{provider} மூலம் உருவாக்கப்படுகிறது...',
      'notify.generated': 'AI பதில் வெற்றிகரமாக உருவாக்கப்பட்டது!',
      'notify.generateFailed': 'AI பதிலை உருவாக்க முடியவில்லை',
      'notify.copied': 'பதில் நகலகத்திற்கு நகலெடுக்கப்பட்டது!',
      'notify.inserted': 'பதில் அரட்டை உள்ளீட்டில் செருகப்பட்டது',
      'notify.noInput': 'செய்தி உள்ளீட்டுப் புலத்தைக் கண்டுபிடிக்க முடியவில்லை',
      'notify.needBaseUrlFirst': 'முதலில் அடிப்படை URL ஐ உள்ளிடவும்',
      'notify.loadingModels': 'மாதிரிகள் ஏற்றப்படுகின்றன...',
      'notify.modelsFailed': 'மாதிரிகளை ஏற்ற முடியவில்லை: {error}',
      'notify.noModels': 'வழங்குநர் எந்த மாதிரியையும் பட்டியலிடவில்லை',
      'notify.modelsLoaded':
        '{count} மாதிரிகள் ஏற்றப்பட்டன - ஒன்றைத் தேர்ந்தெடுக்க மாதிரிப் பெட்டியைச் சொடுக்கவும்',
      'notify.noResponse': 'பதில் இல்லை',
      'notify.testing': '{provider} சோதிக்கப்படுகிறது...',
      'notify.testOk': '{provider} பதிலளித்தது - இணைப்பு வேலை செய்கிறது',
      'notify.testFailed': 'சோதனை தோல்வியடைந்தது: பதில் இல்லை',
      'notify.savedNeedsPermission':
        'சேமிக்கப்பட்டது. Chrome {host} ஐ அணுக நீட்டிப்புச் சாளரத்தைத் திறக்கவும்.',
      'notify.saved': 'அமைப்புகள் வெற்றிகரமாகச் சேமிக்கப்பட்டன!',

      // Instructions dialog
      'instructions.title': 'அடுத்த செய்திக்கான வழிமுறைகள்',
      'instructions.body':
        'இந்த உரையாடலுக்கு AI எவ்வாறு பதிலளிக்க வேண்டும் என்பதற்கான குறிப்பிட்ட வழிமுறைகளை வழங்கவும் (விருப்பத்தேர்வு):',
      'instructions.placeholder':
        'எடுத்துக்காட்டு: மிகவும் முறையாக இரு, தொழில்நுட்ப விவரங்களில் கவனம் செலுத்து, ஊக்கமளிப்பதாக இரு, முதலியன.',
      'instructions.skip': 'தவிர்',
      'instructions.apply': 'வழிமுறைகளைப் பயன்படுத்து',

      // Response dialog
      'response.title': 'AI உருவாக்கிய பதில்',
      'response.copy': 'நகலகத்திற்கு நகலெடு',
      'response.insert': 'அரட்டையில் செருகு',

      // Settings dialog
      'settings.title': 'AI உதவியாளர் அமைப்புகள்',
      'settings.provider': 'AI வழங்குநர்:',
      'settings.apiKey': 'API விசை:',
      'settings.apiKeyPlaceholder': 'உங்கள் API விசை',
      'settings.model': 'மாதிரி:',
      'settings.modelPlaceholder': 'மாதிரியின் பெயர்',
      'settings.modelHint': 'வழங்குநரின் இயல்புநிலையைப் பயன்படுத்த இதை வெறுமையாக விடவும்.',
      'settings.loadModels': 'வழங்குநரிடமிருந்து மாதிரிகளை ஏற்று',
      'settings.baseUrl': 'API அடிப்படை URL:',
      'settings.baseUrlHint': '{url} க்கு இதை வெறுமையாக விடவும்',
      'settings.baseUrlHintCustom':
        '/chat/completions ஐ வழங்கும் எந்த முனையத்தையும் இங்கே சுட்டவும்.',
      'settings.noKeyNeeded': 'இந்த வழங்குநர் விசை இல்லாமல் வேலை செய்கிறது.',
      'settings.keyDocs': '<a href="{url}" target="_blank" rel="noopener">{label}</a> இல் ஒரு விசையை உருவாக்கவும்',
      'settings.keyPrefix': ', இது "{prefix}" என்று தொடங்கும்.',
      'settings.keyStorage':
        'விசைகள் உங்கள் உலாவிச் சுயவிவரத்தில் சேமிக்கப்படுகின்றன, நீங்கள் தேர்ந்தெடுக்கும் வழங்குநருக்கு மட்டுமே அனுப்பப்படும்.',
      'settings.uiLanguage': 'இடைமுக மொழி:',
      'settings.uiLanguageHint':
        'நீட்டிப்பின் சொந்த பட்டிகள் மற்றும் செய்திகளை மாற்றுகிறது. உடனடியாக நடைமுறைக்கு வரும்.',
      'settings.replyLanguage': 'பதில் மொழி:',
      'settings.replyLanguageAuto': 'தானியங்கி - உரையாடலின் மொழியிலேயே',
      'settings.replyLanguageHint':
        'அரட்டை எந்த மொழியில் இருந்தாலும், AI பதில்களை வரையும் மொழி.',
      'settings.systemInstructions': 'கணினி வழிமுறைகள்:',
      'settings.systemInstructionsPlaceholder': 'AI க்கான தனிப்பயன் வழிமுறைகளை உள்ளிடவும்...',
      'settings.instructionsLead': 'AI க்கான வழிமுறைகள்:',
      'settings.instructionsBody':
        'AI எவ்வாறு நடந்துகொள்ள வேண்டும், அதன் ஆளுமை, தொனி அல்லது குறிப்பிட்ட வழிகாட்டுதல்களை வரையறுக்கவும்.',
      'settings.examplesLead': 'எடுத்துக்காட்டுகள்:',
      'settings.example1': 'எப்போதும் நட்பான, தொழில்முறையான முறையில் பதிலளி',
      'settings.example2': 'பதில்களைச் சுருக்கமாகவும் நேரடியாகவும் வைத்திரு',
      'settings.example3': 'என் வணிகத்திற்கான வாடிக்கையாளர் ஆதரவு முகவராகச் செயல்படு',
      'settings.example4': 'தமிழில் பதிலளி, மிகவும் அன்பாக இரு',
      'settings.presetsSummary': '🎯 முன்னமைவு வழிமுறைகள் (விரிக்கச் சொடுக்கவும்)',
      'settings.preset.professional': '👔 தொழில்முறை',
      'settings.preset.friendly': '😊 நட்பான',
      'settings.preset.brief': '⚡ சுருக்கமான',
      'settings.preset.creative': '🎨 ஆக்கப்பூர்வ',
      'settings.preset.support': '🛠️ ஆதரவு முகவர்',
      'settings.preset.translator': '🌐 மொழிபெயர்ப்பாளர்',
      'settings.testLabel': 'API இணைப்பைச் சோதி:',
      'settings.test': 'இணைப்பைச் சோதி',
      'settings.save': 'அமைப்புகளைச் சேமி',

      // Help page
      'help.pageTitle': 'WhatsApp AI உதவியாளர் - உதவி',
      'help.subtitle': 'முழுமையான வழிகாட்டியும் ஆவணமும்',
      'help.languageLabel': 'மொழி:',

      'help.start.title': '🚀 தொடங்குதல்',
      'help.start.1.lead': 'நீட்டிப்பை நிறுவுங்கள்:',
      'help.start.1.body':
        'Chrome இல் chrome://extensions/ க்குச் சென்று, Developer mode ஐ இயக்கி, "Load unpacked" ஐச் சொடுக்கி நீட்டிப்புக் கோப்புறையைத் தேர்ந்தெடுத்து நீட்டிப்பை ஏற்றுங்கள்.',
      'help.start.2.lead': 'API விசையைப் பெறுங்கள்:',
      'help.start.2.body':
        'ஒரு வழங்குநரைத் தேர்ந்தெடுத்து விசையை உருவாக்குங்கள் — கீழே உள்ள <a href="#providers">ஆதரிக்கப்படும் வழங்குநர்கள்</a> பகுதியைப் பார்க்கவும். பெரும்பாலானவற்றில் இலவசத் திட்டம் உள்ளது; உங்கள் கணினியிலேயே இயங்கும் Ollama க்கு விசையே தேவையில்லை.',
      'help.start.3.lead': 'WhatsApp Web ஐத் திறங்கள்:',
      'help.start.3.body':
        '<a href="https://web.whatsapp.com" target="_blank">web.whatsapp.com</a> க்குச் சென்று QR குறியீட்டை ஸ்கேன் செய்து உள்நுழையுங்கள்.',
      'help.start.4.lead': 'அமைப்புகளை உள்ளமையுங்கள்:',
      'help.start.4.body':
        'மிதக்கும் AI பொத்தானைச் சொடுக்கி, அமைப்புகளுக்குச் சென்று உங்கள் வழங்குநரைத் தேர்ந்தெடுத்து அதன் API விசையை ஒட்டுங்கள்.',

      'help.features.title': '✨ அம்சங்கள்',
      'help.features.export.title': 'உரையாடல்களை ஏற்றுமதி செய்தல்',
      'help.features.export.body':
        'முழு WhatsApp உரையாடல்களையும் உரைக் கோப்புகளாகப் பிரித்தெடுத்துப் பதிவிறக்கி, காப்புப் பிரதிக்கோ பகுப்பாய்வுக்கோ பயன்படுத்துங்கள்.',
      'help.features.generate.title': 'AI பதில் உருவாக்கம்',
      'help.features.generate.body':
        'உரையாடல் வரலாற்றின் சூழலுக்கேற்ற பதில்களை, நீங்கள் தேர்ந்தெடுக்கும் AI வழங்குநரைக் கொண்டு உருவாக்குங்கள்.',
      'help.features.insert.title': 'நேரடி இணைப்பு',
      'help.features.insert.body':
        'AI உருவாக்கிய பதில்களை நேரடியாக WhatsApp இன் செய்தி உள்ளீட்டுப் புலத்தில் தடையின்றிச் செருகுங்கள்.',
      'help.features.copy.title': 'நகலகத்திற்கு நகலெடுத்தல்',
      'help.features.copy.body':
        'உருவாக்கப்பட்ட பதில்களை எளிதாக நகலெடுத்து, பிற பயன்பாடுகளில் பயன்படுத்தலாம் அல்லது அனுப்பும் முன் திருத்தலாம்.',
      'help.features.language.title': 'உங்கள் மொழி',
      'help.features.language.body':
        'நீட்டிப்பை ஆங்கிலத்திலோ தமிழிலோ படியுங்கள்; இடைமுக மொழியைப் பொருட்படுத்தாமல், நீங்கள் தேர்ந்தெடுக்கும் எந்த மொழியிலும் AI பதில்களை வரையச் செய்யுங்கள்.',

      'help.howTo.title': '📖 பயன்படுத்தும் முறை',
      'help.howTo.export.title': 'உரையாடல்களை ஏற்றுமதி செய்தல்',
      'help.howTo.export.1': 'ஏதேனும் ஒரு WhatsApp உரையாடலைத் திறங்கள்',
      'help.howTo.export.2': 'கீழ் வலது மூலையில் உள்ள பச்சை நிற மிதக்கும் AI பொத்தானைச் சொடுக்குங்கள்',
      'help.howTo.export.3': '"உரையாடலை ஏற்றுமதி செய்" என்பதைத் தேர்ந்தெடுங்கள்',
      'help.howTo.export.4': 'உரையாடல் உரைக் கோப்பாகப் பதிவிறக்கப்படும்',
      'help.howTo.generate.title': 'AI பதில்களை உருவாக்குதல்',
      'help.howTo.generate.1': 'ஒரு வழங்குநரையும் அதன் API விசையையும் உள்ளமைத்திருப்பதை உறுதிசெய்யுங்கள்',
      'help.howTo.generate.2': 'ஏதேனும் ஒரு WhatsApp உரையாடலைத் திறங்கள்',
      'help.howTo.generate.3': 'மிதக்கும் AI பொத்தானைச் சொடுக்குங்கள்',
      'help.howTo.generate.4': '"AI பதிலை உருவாக்கு" என்பதைத் தேர்ந்தெடுங்கள்',
      'help.howTo.generate.5': 'AI உரையாடலைப் பகுப்பாய்வு செய்து பதிலை உருவாக்கும் வரை காத்திருங்கள்',
      'help.howTo.generate.6': 'பதிலை நகலெடுக்கவோ, நேரடியாக அரட்டையில் செருகவோ தேர்ந்தெடுங்கள்',
      'help.howTo.detect.title': 'செய்தி கண்டறிதல்',
      'help.howTo.detect.body':
        'இந்த CSS தேர்விகளைப் பயன்படுத்தி, வரும் மற்றும் செல்லும் செய்திகள் இரண்டையும் நீட்டிப்பு தானாகவே கண்டறிகிறது:',

      'help.language.title': '🌐 மொழி',
      'help.language.body':
        'இரண்டு தனித்தனி அமைப்புகள், இரண்டுமே AI பொத்தான் → அமைப்புகள் உரையாடலில் உள்ளன.',
      'help.language.ui.lead': 'இடைமுக மொழி:',
      'help.language.ui.body':
        'நீட்டிப்பின் சொந்த பட்டிகள், உரையாடல்கள், செய்திகளின் மொழி. ஆங்கிலமும் தமிழும் கிடைக்கின்றன; மாற்றியவுடன் இடைமுகம் உடனடியாக மீண்டும் வரையப்படும், மீளேற்றம் தேவையில்லை.',
      'help.language.reply.lead': 'பதில் மொழி:',
      'help.language.reply.body':
        'AI தன் வரைவுகளை எழுதும் மொழி. அரட்டையின் மொழியையே பின்பற்ற "தானியங்கி" எனவே விடுங்கள்; அல்லது தமிழ், ஆங்கிலம், சிங்களம், இந்தி போன்ற ஒன்றைத் தேர்ந்தெடுத்தால், எப்போதும் அந்த மொழியில், அதன் சொந்த எழுத்துருவிலேயே பதில்கள் வரும்.',
      'help.language.note':
        'இவ்விரண்டும் ஒன்றையொன்று சாராதவை: ஆங்கில இடைமுகம் தமிழ்ப் பதில்களை வரையலாம், தமிழ் இடைமுகம் ஆங்கிலப் பதில்களை வரையலாம்.',

      'help.providers.title': '🔌 ஆதரிக்கப்படும் வழங்குநர்கள்',
      'help.providers.body':
        'அமைப்புகளில் ஒன்றைத் தேர்ந்தெடுங்கள். ஒவ்வொரு வழங்குநருக்கும் தனித்தனியாக விசைகள் நினைவில் வைக்கப்படுகின்றன, எனவே மீண்டும் விசையை ஒட்டாமலேயே அவற்றுக்கிடையே மாறலாம்.',
      'help.providers.ollama': 'உங்கள் சொந்தக் கணினியில் இயங்கும் மாதிரி, விசை எதுவும் தேவையில்லை',
      'help.providers.custom':
        '<code>/chat/completions</code> ஐ வழங்கும் எந்த முனையமும்: LM Studio, vLLM, Together, Fireworks, Azure OpenAI நுழைவாயில், அல்லது உங்கள் சொந்தப் பினாமி',

      'help.config.title': '⚙️ உள்ளமைவு',
      'help.config.key.title': 'API விசை அமைத்தல்',
      'help.config.key.1': 'மேலே உள்ள இணைப்புகளிலிருந்து, உங்கள் வழங்குநரிடம் ஒரு விசையை உருவாக்குங்கள்',
      'help.config.key.2': 'WhatsApp Web இல், AI பொத்தான் → அமைப்புகள் என்பதைச் சொடுக்குங்கள்',
      'help.config.key.3': 'கீழிறங்கு பட்டியலிலிருந்து வழங்குநரைத் தேர்ந்தெடுங்கள்',
      'help.config.key.4': 'உங்கள் API விசையை ஒட்டுங்கள்',
      'help.config.key.5':
        'விருப்பப்பட்டால் ஒரு மாதிரியை அமைக்கலாம் — வழங்குநரின் இயல்புநிலைக்கு வெறுமையாக விடுங்கள், அல்லது உங்கள் விசை எவற்றை அணுக முடியும் எனப் பார்க்க "வழங்குநரிடமிருந்து மாதிரிகளை ஏற்று" என்பதை அழுத்துங்கள்',
      'help.config.key.6': 'சேமித்த பிறகு, "இணைப்பைச் சோதி" மூலம் அது வேலை செய்கிறதா எனச் சரிபாருங்கள்',
      'help.config.custom.title': 'தனிப்பயன் மற்றும் உள்ளூர் முனையங்கள்',
      'help.config.custom.1':
        'நீட்டிப்பின் manifest இல் பட்டியலிடப்பட்ட புரவலன்களை மட்டுமே Chrome அணுக அனுமதிக்கிறது. தனிப்பயன் முனையமோ உள்ளூர் Ollama வோ அவற்றில் இல்லை, எனவே நீட்டிப்புச் சாளரத்தை ஒருமுறை திறந்து "அணுகலை வழங்கு" என்பதை அழுத்துங்கள் — அந்த அனுமதியை Chrome சாளரத்திலிருந்து மட்டுமே கேட்க முடியும்.',
      'help.config.custom.2':
        'Ollama வை இயக்குகிறீர்களா? நீட்டிப்பின் கோரிக்கைகளை அது ஏற்குமாறு <code>OLLAMA_ORIGINS=*</code> உடன் தொடங்குங்கள்.',
      'help.config.warning.lead': '⚠️ முக்கியம்:',
      'help.config.warning.body':
        'உங்கள் API விசையைப் பாதுகாப்பாக வைத்திருங்கள், ஒருபோதும் பொதுவில் பகிர வேண்டாம். நீட்டிப்பு அதை உங்கள் உலாவியில் உள்ளூரிலேயே சேமிக்கிறது.',

      'help.tech.title': '🔧 தொழில்நுட்ப விவரங்கள்',
      'help.tech.extract.title': 'செய்திப் பிரித்தெடுப்பு',
      'help.tech.extract.body': 'செய்திகளை நம்பகமாகப் பிரித்தெடுக்க நீட்டிப்பு பல தேர்விகளைப் பயன்படுத்துகிறது:',
      'help.tech.extract.1': 'முதன்மைச் செய்தி உரை',
      'help.tech.extract.2': 'மாற்று உரைத் தேர்வி',
      'help.tech.extract.3': 'செய்தி நேர முத்திரைகள்',
      'help.tech.extract.4': 'குழு அரட்டைகளுக்கான அனுப்புநர் தகவல்',
      'help.tech.ai.title': 'AI ஒருங்கிணைப்பு',
      'help.tech.ai.body': 'நீங்கள் எந்த வழங்குநரைத் தேர்ந்தெடுத்தாலும், ஒரே உருவாக்க அமைப்புகளுடன் அழைக்கப்படுகிறது:',
      'help.tech.ai.provider': 'வழங்குநர்: உங்கள் தேர்வு (மேலே பார்க்கவும்)',
      'help.tech.ai.model': 'மாதிரி: வழங்குநரின் இயல்புநிலை, அல்லது நீங்கள் அமைப்பது',
      'help.tech.ai.temperature': 'வெப்பநிலை: 0.7 (சமநிலையான ஆக்கத்திறன்)',
      'help.tech.ai.tokens': 'அதிகபட்ச வெளியீட்டுத் தொகைகள்: 1024',
      'help.tech.ai.context': 'சூழல்: சமீபத்திய 100 செய்திகள் வரை',
      'help.tech.ai.note':
        'கோரிக்கைகள் பக்கத்திலிருந்து அல்லாமல், நீட்டிப்பின் பின்னணிச் சேவைப் பணியாளரிடமிருந்து அனுப்பப்படுகின்றன. எனவே CORS கொள்கை எதுவாக இருந்தாலும் ஒவ்வொரு வழங்குநரையும் அணுக முடியும்.',
      'help.tech.supported.title': 'ஆதரிக்கப்படும் அம்சங்கள்',
      'help.tech.supported.1': '✅ உரைச் செய்திகள்',
      'help.tech.supported.2': '✅ குழு அரட்டைகள்',
      'help.tech.supported.3': '✅ தனிநபர் அரட்டைகள்',
      'help.tech.supported.4': '✅ செய்தி நேர முத்திரைகள்',
      'help.tech.supported.5': '✅ அனுப்புநர் அடையாளம்',
      'help.tech.supported.6': '⚠️ ஊடகச் செய்திகள் (உரைப் பிரித்தெடுப்பு மட்டும்)',
      'help.tech.supported.7': '❌ குரல் செய்திகள்',
      'help.tech.supported.8': '❌ நிலைப் புதுப்பிப்புகள்',

      'help.trouble.title': '🐛 சிக்கல் தீர்வு',
      'help.trouble.notWorking.title': 'நீட்டிப்பு வேலை செய்யவில்லை',
      'help.trouble.notWorking.1': 'WhatsApp Web பக்கத்தைப் புதுப்பிக்கவும்',
      'help.trouble.notWorking.2': 'chrome://extensions/ இல் நீட்டிப்பு இயக்கப்பட்டுள்ளதா எனச் சரிபார்க்கவும்',
      'help.trouble.notWorking.3':
        'நீங்கள் web.whatsapp.com இல் இருப்பதை உறுதிசெய்யுங்கள் (பிற WhatsApp பதிப்புகளில் அல்ல)',
      'help.trouble.noResponse.title': 'AI பதில்கள் உருவாகவில்லை',
      'help.trouble.noResponse.1': 'API விசை, அமைப்புகளில் தேர்ந்தெடுத்த வழங்குநருக்கு உரியதுதானா எனச் சரிபார்க்கவும்',
      'help.trouble.noResponse.2':
        'அமைப்புகளில் "இணைப்பைச் சோதி" என்பதை அழுத்துங்கள் — வழங்குநரின் சொந்தப் பிழையையே அது காட்டும்',
      'help.trouble.noResponse.3':
        '404 என்றால் பொதுவாக மாதிரியின் பெயர் தவறு; இயல்புநிலையைப் பயன்படுத்த அதை அழித்துவிடுங்கள்',
      'help.trouble.noResponse.4':
        'தனிப்பயன் அல்லது உள்ளூர் முனையமாக இருந்தால், நீட்டிப்புச் சாளரத்திலிருந்து அதன் புரவலனுக்கு அணுகலை வழங்குங்கள்',
      'help.trouble.noResponse.5':
        'உங்கள் இணைய இணைப்பையும், வழங்குநரின் வீத வரம்புகளை மீறவில்லை என்பதையும் சரிபார்க்கவும்',
      'help.trouble.noMessages.title': 'செய்திகள் பிரித்தெடுக்கப்படவில்லை',
      'help.trouble.noMessages.1': 'உரையாடல் முழுமையாக ஏற்றப்பட்டுள்ளதா என உறுதிசெய்யுங்கள்',
      'help.trouble.noMessages.2': 'தேவைப்பட்டால் பழைய செய்திகளை ஏற்ற மேலே உருட்டுங்கள்',
      'help.trouble.noMessages.3': 'பக்கத்தைப் புதுப்பித்து மீண்டும் முயற்சிக்கவும்',
      'help.trouble.wrongLanguage.title': 'பதில்கள் தவறான மொழியில் வருகின்றன',
      'help.trouble.wrongLanguage.1':
        'கணினி வழிமுறைகள் பெட்டியில் மொழியைக் கேட்பதற்குப் பதிலாக, அமைப்புகளில் பதில் மொழியை அமையுங்கள் — அந்த அமைப்பே கடைசியாகச் சேர்க்கப்பட்டு மேலோங்கும்',
      'help.trouble.wrongLanguage.2':
        'சிறிய மாதிரிகள் ஆங்கிலம் அல்லாத மொழிகளில் பலவீனமானவை; பதில்கள் மீண்டும் ஆங்கிலத்திற்கு நகர்ந்தால் பெரிய மாதிரியை முயற்சியுங்கள்',

      'help.privacy.title': '🔒 தனியுரிமையும் பாதுகாப்பும்',
      'help.privacy.1': 'அனைத்துச் செய்தி செயலாக்கமும் உங்கள் உலாவியில் உள்ளூரிலேயே நடக்கிறது',
      'help.privacy.2': 'API விசைகள் Chrome இன் ஒத்திசைவு சேமிப்பில், ஒரு வழங்குநருக்கு ஒன்று வீதம் சேமிக்கப்படுகின்றன',
      'help.privacy.3':
        'உரையாடல்கள் நீங்கள் தேர்ந்தெடுத்த வழங்குநருக்கு மட்டுமே, நீங்கள் வெளிப்படையாக AI பதிலைக் கோரும்போது மட்டுமே அனுப்பப்படுகின்றன',
      'help.privacy.4':
        'வெளிப்புற சேவையகங்களில் எந்தத் தரவும் சேமிக்கப்படுவதில்லை (உங்கள் வழங்குநருக்கான API அழைப்புகளின்போது தவிர)',
      'help.privacy.5': 'பாதுகாப்புக் கருதி, நீட்டிப்பு web.whatsapp.com இல் மட்டுமே வேலை செய்கிறது',

      'help.versions.title': '📝 பதிப்பு வரலாறு',
      'help.versions.13':
        'எந்த AI வழங்குநரையும் தேர்ந்தெடுங்கள்: Gemini, Claude, GPT, OpenRouter, Groq, DeepSeek, Mistral, Grok, Ollama அல்லது தனிப்பயன் முனையம்',
      'help.versions.10': 'உரையாடல் ஏற்றுமதி மற்றும் AI பதில் உருவாக்கத்துடன் முதல் வெளியீடு',

      'help.support.title': '📞 ஆதரவு',
      'help.support.body':
        'சிக்கல்கள், பரிந்துரைகள் அல்லது பங்களிப்புகளுக்கு, நீட்டிப்பின் ஆவணங்களைப் பார்க்கவும் அல்லது திட்டக் களஞ்சியத்தில் ஒரு issue ஐ உருவாக்கவும்.'
    }
  };

  let current = DEFAULT_LOCALE;

  function supported(locale) {
    return Object.prototype.hasOwnProperty.call(MESSAGES, locale);
  }

  /**
   * The best supported match for a BCP-47 tag - "ta-LK" and "ta" both land on
   * Tamil, anything unknown falls back to English.
   */
  function normalize(locale) {
    if (!locale) return DEFAULT_LOCALE;
    const tag = String(locale).toLowerCase();
    if (supported(tag)) return tag;

    const base = tag.split('-')[0];
    return supported(base) ? base : DEFAULT_LOCALE;
  }

  /** What the browser suggests, used only until the user picks for themselves. */
  function detect() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    return normalize((nav && (nav.language || (nav.languages || [])[0])) || DEFAULT_LOCALE);
  }

  function setLocale(locale) {
    current = normalize(locale);
    return current;
  }

  function getLocale() {
    return current;
  }

  /**
   * Looks up `key`, substituting {placeholders} from `params`.
   *
   * A key missing from the active locale falls back to English rather than
   * rendering blank, so a half-finished translation degrades one string at a
   * time instead of emptying the interface.
   */
  function t(key, params) {
    const template = (MESSAGES[current] && MESSAGES[current][key]) ||
      MESSAGES[DEFAULT_LOCALE][key];

    if (template === undefined) return key;
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
  }

  /**
   * Translates a static page in place. Elements carry the key in `data-i18n`,
   * `data-i18n-placeholder` or `data-i18n-title`; `data-i18n-html` marks the
   * few strings that carry their own markup.
   */
  function applyToDom(scope) {
    const rootEl = scope || (typeof document !== 'undefined' ? document : null);
    if (!rootEl) return;

    rootEl.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = t(key);
      } else {
        el.textContent = t(key);
      }
    });

    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });

    rootEl.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });

    if (rootEl.documentElement) {
      rootEl.documentElement.lang = current;
    }
  }

  /** The sentence appended to the system prompt to pin the reply language. */
  function replyLanguageDirective(code) {
    const entry = REPLY_LANGUAGES.find((lang) => lang.code === code);
    if (!entry || !entry.prompt) return '';

    return `Always write your reply in ${entry.prompt}, regardless of the language ` +
      'of the conversation. Use the natural script of that language, not a ' +
      'romanised transliteration.';
  }

  return {
    DEFAULT_LOCALE,
    LOCALES,
    REPLY_LANGUAGES,
    MESSAGES,
    normalize,
    detect,
    setLocale,
    getLocale,
    t,
    applyToDom,
    replyLanguageDirective
  };
});
