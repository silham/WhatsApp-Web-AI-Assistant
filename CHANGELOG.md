# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Tamil. The whole interface - the floating menu, every dialog, every
  notification, the popup and the help page - is available in Tamil, chosen
  with the new "Interface Language" setting. Switching redraws the interface
  immediately; there is nothing to reload.
- A "Reply Language" setting that pins the language the AI drafts in, separate
  from the interface language, with thirteen options and an "Auto" default that
  follows the conversation. The instruction is appended to the system prompt
  last, so it takes precedence over anything in the custom instructions.
- `lib/i18n.js` holds every interface string and the locale lookup, and is unit
  tested - including a check that each locale defines exactly the same keys,
  with the same placeholders, as English.
- The help page carries its own language picker, which writes the choice back
  to settings.

### Fixed

- Generation no longer fails with "Endpoint or model not found". Google shut
  down `gemini-2.0-flash` - until now the extension's default - on 1 June 2026.
  The default is `gemini-3.5-flash`, Google's own migration target for it, and
  the model list offers the current 3.x and 2.5 line.
- An install that had explicitly pinned a withdrawn model is moved to its
  replacement on load, rather than 404ing on every request until the user
  happens to open the model picker. Providers now declare their retirements in
  `retiredModels`, so the next one is a data change.

### Changed

- The extension's name and description in `chrome://extensions` and the Web
  Store now come from `_locales/`, so they are localised too. Only those
  manifest fields use `chrome.i18n` - the interface itself does not, because a
  `chrome.i18n` locale follows the browser's UI language and cannot be changed
  from inside the extension.

## [1.3.0] - 2026-09-01

### Added

- The AI provider is now a setting. Alongside Google Gemini the extension
  supports Anthropic Claude, OpenAI, OpenRouter, Groq, DeepSeek, Mistral AI and
  xAI Grok, a locally running Ollama, and a "Custom" option for any endpoint
  that serves `/chat/completions` - LM Studio, vLLM, Together, Fireworks, an
  Azure OpenAI gateway or your own proxy.
- The model is configurable per provider, with the provider's default used when
  left blank. "Load models from provider" asks the provider which models the
  key can actually reach, so a model name no longer has to be guessed.
- API keys, models and base URLs are remembered per provider, so switching
  between them does not mean pasting a key again.
- The popup shows which provider and model are configured, and grants Chrome
  access to a custom or local endpoint's host - a permission Chrome will only
  ask for from an extension page.
- `lib/providers.js` holds one adapter per provider (request, response, errors)
  and `lib/settings.js` owns the storage layout; both are unit tested, along
  with the background worker's request path.

### Changed

- Provider calls are made from the background service worker rather than the
  content script. A content script's `fetch` is an ordinary cross-origin
  request from `web.whatsapp.com`, so it only reached providers that send
  permissive CORS headers; from the worker it is covered by the manifest's host
  permissions and works for every provider.
- System instructions are sent as the provider's own system field rather than
  being pasted at the top of the user prompt, which is what every provider
  expects and what their prompt caching keys on.
- Error messages name the provider and quote its own explanation, instead of
  mapping a few HTTP codes to generic advice.
- The API key check is per provider rather than a hard-coded `AIza` prefix, and
  an unrecognised key shape is allowed through rather than rejected.

### Migration

- An existing Gemini key is carried over on first run and the old
  `geminiApiKey` entry is removed. Nothing needs to be re-entered.

## [1.2.0] - 2026-08-31

### Fixed

- Exported conversations are now in true chronological order. Timestamp parsing
  only understood the 24-hour, day-first format (`09:21, 19/08/2025`), so a
  browser rendering `7:04 AM, 7/31/2026` lost both the AM/PM marker and the
  date, and messages were sorted by time of day across unrelated dates. Parsing
  now handles 12- and 24-hour clocks, day-first, month-first and ISO dates,
  2-digit years and alternative separators, and works out a conversation's date
  order from the dates themselves.
- Messages sent within the same minute keep the order they appear in the chat,
  rather than the order they happened to be scrolled into the cache.
- Timestamps that cannot be parsed no longer fall back to the current time,
  which used to scatter them through the middle of an export. They keep their
  original order at the end instead.
- Removed a `web_accessible_resources` entry for `inject.js`, a file that does
  not exist in the extension.

### Added

- `lib/timestamps.js`: timestamp parsing and ordering, split out of
  `content.js` so it can be unit tested outside the browser.
- A test suite (`npm test`) covering timestamp parsing and message ordering.
- ESLint configuration and `npm run lint`.
- `npm run check:manifest`, which validates `manifest.json` and confirms every
  file it references exists and its version matches `package.json`.
- `npm run package`, which builds a Chrome Web Store zip into `dist/`.
- Continuous integration, plus a release workflow that attaches the packaged
  extension to a GitHub release when a `v*` tag is pushed.
- Project documentation: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md` and this changelog.

### Changed

- Switched the content generation endpoint to `gemini-2.0-flash`.
- `manifest.json` version is now `1.1.0` rather than `1.1`, so it can be
  compared directly against `package.json`.

## [1.1.0] - 2025-08-21

### Added

- Instructions modal for steering an individual AI response.

### Changed

- Improved conversation formatting before it is sent to the model.

## [1.0.0] - 2025-08-19

### Added

- Initial release: conversation export, Gemini-generated replies, custom system
  instructions, insert-into-chat and copy-to-clipboard.
- Larger context window, using `gemini-2.5-flash`.

[Unreleased]: https://github.com/silham/WhatsApp-Web-AI-Assistant/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/silham/WhatsApp-Web-AI-Assistant/releases/tag/v1.3.0
[1.2.0]: https://github.com/silham/WhatsApp-Web-AI-Assistant/releases/tag/v1.2.0
[1.1.0]: https://github.com/silham/WhatsApp-Web-AI-Assistant/commit/79de63a
[1.0.0]: https://github.com/silham/WhatsApp-Web-AI-Assistant/commit/0126087
