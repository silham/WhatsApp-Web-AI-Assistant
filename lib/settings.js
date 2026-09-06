/**
 * Reads and writes the assistant's configuration in chrome.storage.sync.
 *
 * Keys, models and base URLs are stored per provider rather than as one active
 * value, so switching from, say, OpenAI to Groq and back does not make the user
 * paste a key again. Only the *selected* provider is a single setting.
 *
 * Versions up to 1.2.0 stored a single `geminiApiKey`; `load()` folds that into
 * the new shape on first read and `save()` clears it, so an upgrade is silent.
 *
 * Shared by the content script, the background worker, the popup and the tests.
 */
(function (root, factory) {
  const api = factory(root);

  if (root) {
    root.AISettings = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const providers = (root && root.LLMProviders) ||
    (typeof require === 'function' ? require('./providers.js') : null);

  const i18n = (root && root.I18n) ||
    (typeof require === 'function' ? require('./i18n.js') : null);

  const DEFAULT_SYSTEM_INSTRUCTIONS =
    'You are a helpful AI assistant that generates appropriate responses for ' +
    'WhatsApp conversations. Keep responses natural, conversational, and ' +
    'contextually relevant.';

  const DEFAULT_REPLY_LANGUAGE = 'auto';

  const STORAGE_KEYS = [
    'aiProvider',
    'aiApiKeys',
    'aiModels',
    'aiBaseUrls',
    'systemInstructions',
    'uiLanguage',
    'replyLanguage',
    // Legacy, read once and migrated away
    'geminiApiKey'
  ];

  /** Guards against a storage value naming a language that was since removed. */
  function knownReplyLanguage(code) {
    return i18n.REPLY_LANGUAGES.some((lang) => lang.code === code)
      ? code
      : DEFAULT_REPLY_LANGUAGE;
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  /**
   * Normalises whatever is in storage - including the pre-1.3 layout - into the
   * shape the rest of the extension expects.
   */
  function fromStored(stored) {
    const raw = asObject(stored);
    const apiKeys = Object.assign({}, asObject(raw.aiApiKeys));

    // Pre-1.3 installs only ever had a Gemini key.
    let migrated = false;
    if (raw.geminiApiKey && !apiKeys.gemini) {
      apiKeys.gemini = raw.geminiApiKey;
      migrated = true;
    }

    // A model the vendor has since withdrawn is rewritten to its replacement,
    // so an install that pinned one keeps working instead of 404ing.
    const models = Object.assign({}, asObject(raw.aiModels));
    Object.keys(models).forEach((id) => {
      const replacement = providers.retiredReplacement(id, models[id]);
      if (replacement) {
        models[id] = replacement;
        migrated = true;
      }
    });

    const provider = providers.get(raw.aiProvider).id;

    return {
      provider,
      apiKeys,
      models,
      baseUrls: asObject(raw.aiBaseUrls),
      systemInstructions: raw.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS,
      // An install that has never chosen a language follows the browser.
      uiLanguage: i18n.normalize(raw.uiLanguage || i18n.detect()),
      replyLanguage: knownReplyLanguage(raw.replyLanguage),
      migrated
    };
  }

  function toStored(settings) {
    return {
      aiProvider: settings.provider,
      aiApiKeys: asObject(settings.apiKeys),
      aiModels: asObject(settings.models),
      aiBaseUrls: asObject(settings.baseUrls),
      systemInstructions: settings.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS,
      uiLanguage: i18n.normalize(settings.uiLanguage),
      replyLanguage: knownReplyLanguage(settings.replyLanguage)
    };
  }

  /** The three per-provider values, resolved for whichever provider is active. */
  function activeConfig(settings, providerId) {
    const id = providerId || settings.provider;
    return {
      provider: id,
      apiKey: (settings.apiKeys && settings.apiKeys[id]) || '',
      model: providers.resolveModel(id, settings.models && settings.models[id]),
      baseUrl: providers.resolveBaseUrl(id, settings.baseUrls && settings.baseUrls[id])
    };
  }

  /**
   * Reloading or updating the extension orphans the copy of a script already
   * running in an open tab: `chrome.runtime.id` goes undefined and every
   * chrome.* call from it rejects with "Extension context invalidated". That
   * string reads as a crash, so storage access reports it as the same
   * "refresh this page" message the background calls use.
   */
  const CONTEXT_LOST =
    /Extension context invalidated|Receiving end does not exist|message port closed/i;

  const chromeApi = () => (root && root.chrome) || null;

  /** True while this script still belongs to a live extension. */
  function extensionAlive() {
    const api = chromeApi();
    return Boolean(api && api.runtime && api.runtime.id);
  }

  function isContextLost(error) {
    return CONTEXT_LOST.test((error && error.message) || '');
  }

  /** Runs a chrome.storage call, naming an orphaned script for what it is. */
  async function withStorage(operation) {
    if (!extensionAlive()) throw new Error(i18n.t('notify.contextInvalidated'));

    try {
      return await operation(chromeApi().storage);
    } catch (error) {
      if (isContextLost(error)) throw new Error(i18n.t('notify.contextInvalidated'));
      throw error;
    }
  }

  async function load() {
    const stored = await withStorage((storage) => storage.sync.get(STORAGE_KEYS));
    return fromStored(stored);
  }

  async function save(settings) {
    await withStorage(async (storage) => {
      await storage.sync.set(toStored(settings));

      // The migration is only complete once the new layout is on disk.
      await storage.sync.remove('geminiApiKey');
    });
  }

  return {
    DEFAULT_SYSTEM_INSTRUCTIONS,
    DEFAULT_REPLY_LANGUAGE,
    STORAGE_KEYS,
    CONTEXT_LOST,
    extensionAlive,
    isContextLost,
    fromStored,
    toStored,
    activeConfig,
    load,
    save
  };
});
