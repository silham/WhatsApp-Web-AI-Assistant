/**
 * Provider registry for the language models the assistant can talk to.
 *
 * Every provider is described by a small adapter that knows three things: how
 * to turn a prompt into an HTTP request, how to dig the generated text back out
 * of the response, and how to explain an error. Everything else in the
 * extension - the settings UI, the background worker that performs the fetch -
 * is written against that shape and never mentions a vendor by name.
 *
 * Most vendors speak the OpenAI chat-completions dialect, so they share one
 * builder and differ only in host, model list and how the key is presented.
 * Gemini and Anthropic get their own builders because their wire formats differ.
 *
 * The module is shared between the content script (which renders the settings
 * UI), the background service worker (which performs the request) and the test
 * suite, so it attaches to `globalThis` and also exports for CommonJS.
 */
(function (root, factory) {
  const api = factory();

  if (root) {
    root.LLMProviders = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_MAX_TOKENS = 1024;
  const DEFAULT_TEMPERATURE = 0.7;

  /** Trailing slashes make `${base}/models` produce a double slash. */
  function trimBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function resolveBaseUrl(provider, baseUrl) {
    return trimBaseUrl(baseUrl) || provider.defaultBaseUrl;
  }

  /**
   * The chat-completions request body that OpenAI, OpenRouter, Groq, DeepSeek,
   * Mistral, xAI and every "OpenAI-compatible" gateway accept unchanged.
   */
  function openAiCompatible(overrides) {
    return Object.assign({
      wireFormat: 'openai',
      requiresKey: true,
      allowCustomBaseUrl: true,

      buildRequest(options) {
        const messages = [];
        if (options.systemPrompt) {
          messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: options.userPrompt });

        return {
          url: `${resolveBaseUrl(this, options.baseUrl)}/chat/completions`,
          method: 'POST',
          headers: Object.assign(
            {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${options.apiKey}`
            },
            this.extraHeaders || {}
          ),
          body: {
            model: options.model || this.defaultModel,
            messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens
          }
        };
      },

      parseResponse(data) {
        const choice = data && data.choices && data.choices[0];
        if (!choice) return null;

        const message = choice.message || {};

        // Most providers return a plain string; a few return the content as an
        // array of parts, the way the newer multimodal APIs do.
        if (typeof message.content === 'string') return message.content;
        if (Array.isArray(message.content)) {
          return message.content
            .map((part) => (typeof part === 'string' ? part : part && part.text) || '')
            .join('');
        }

        // Reasoning models sometimes leave `content` empty and put the answer
        // in a sibling field.
        if (typeof message.reasoning_content === 'string') return message.reasoning_content;
        if (typeof choice.text === 'string') return choice.text;

        return null;
      },

      parseError(data) {
        if (!data) return null;
        if (typeof data.error === 'string') return data.error;
        if (data.error && data.error.message) return data.error.message;
        if (data.message) return data.message;
        return null;
      },

      listModelsRequest(options) {
        return {
          url: `${resolveBaseUrl(this, options.baseUrl)}/models`,
          method: 'GET',
          headers: Object.assign(
            { Authorization: `Bearer ${options.apiKey}` },
            this.extraHeaders || {}
          )
        };
      },

      parseModels(data) {
        const items = (data && data.data) || [];
        return items.map((item) => item && item.id).filter(Boolean);
      },

      truncationHint(data) {
        const choice = data && data.choices && data.choices[0];
        return choice && choice.finish_reason === 'length';
      }
    }, overrides);
  }

  const PROVIDERS = [
    {
      id: 'gemini',
      label: 'Google Gemini',
      wireFormat: 'gemini',
      requiresKey: true,
      allowCustomBaseUrl: false,
      defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      origins: ['https://generativelanguage.googleapis.com/*'],
      defaultModel: 'gemini-3.5-flash',
      models: [
        'gemini-3.8-flash',
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-pro'
      ],
      // Google shut these down on 2026-06-01; a stored choice is rewritten
      // rather than sent, which would fail with a 404.
      retiredModels: {
        'gemini-2.0-flash': 'gemini-3.5-flash',
        'gemini-2.0-flash-001': 'gemini-3.5-flash',
        'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
        'gemini-2.0-flash-lite-001': 'gemini-3.1-flash-lite',
        'gemini-1.5-pro': 'gemini-2.5-pro',
        'gemini-1.5-flash': 'gemini-3.5-flash'
      },
      keyPrefix: 'AIza',
      keyPlaceholder: 'AIza...',
      docsUrl: 'https://aistudio.google.com/app/apikey',
      docsLabel: 'Google AI Studio',

      buildRequest(options) {
        const model = options.model || this.defaultModel;
        const body = {
          contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
          generationConfig: {
            temperature: options.temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: options.maxTokens
          },
          safetySettings: [
            'HARM_CATEGORY_HARASSMENT',
            'HARM_CATEGORY_HATE_SPEECH',
            'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'HARM_CATEGORY_DANGEROUS_CONTENT'
          ].map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }))
        };

        if (options.systemPrompt) {
          body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
        }

        return {
          url: `${resolveBaseUrl(this, options.baseUrl)}/models/${encodeURIComponent(model)}:generateContent`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': options.apiKey
          },
          body
        };
      },

      parseResponse(data) {
        const candidate = data && data.candidates && data.candidates[0];
        if (!candidate) return typeof (data && data.text) === 'string' ? data.text : null;

        const parts = candidate.content && candidate.content.parts;
        if (Array.isArray(parts)) {
          const text = parts.map((part) => (part && part.text) || '').join('');
          if (text) return text;
        }

        if (typeof candidate.content === 'string') return candidate.content;
        if (typeof candidate.text === 'string') return candidate.text;
        return null;
      },

      parseError(data) {
        if (data && data.error && data.error.message) return data.error.message;
        return null;
      },

      listModelsRequest(options) {
        return {
          url: `${resolveBaseUrl(this, options.baseUrl)}/models`,
          method: 'GET',
          headers: { 'x-goog-api-key': options.apiKey }
        };
      },

      parseModels(data) {
        const items = (data && data.models) || [];
        return items
          .filter((item) => {
            const methods = (item && item.supportedGenerationMethods) || [];
            return methods.length === 0 || methods.includes('generateContent');
          })
          .map((item) => String((item && item.name) || '').replace(/^models\//, ''))
          .filter(Boolean);
      },

      truncationHint(data) {
        const candidate = data && data.candidates && data.candidates[0];
        return Boolean(candidate && candidate.finishReason === 'MAX_TOKENS');
      }
    },

    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      wireFormat: 'anthropic',
      requiresKey: true,
      allowCustomBaseUrl: true,
      defaultBaseUrl: 'https://api.anthropic.com/v1',
      origins: ['https://api.anthropic.com/*'],
      defaultModel: 'claude-sonnet-5',
      models: [
        'claude-sonnet-5',
        'claude-opus-5',
        'claude-fable-5',
        'claude-haiku-4-5-20251001'
      ],
      keyPrefix: 'sk-ant-',
      keyPlaceholder: 'sk-ant-...',
      docsUrl: 'https://console.anthropic.com/settings/keys',
      docsLabel: 'Anthropic Console',

      headers(apiKey) {
        return {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          // Anthropic rejects requests from a browser origin unless this opt-in
          // is present. The key never leaves the user's machine either way.
          'anthropic-dangerous-direct-browser-access': 'true'
        };
      },

      buildRequest(options) {
        const body = {
          model: options.model || this.defaultModel,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          messages: [{ role: 'user', content: options.userPrompt }]
        };

        if (options.systemPrompt) body.system = options.systemPrompt;

        return {
          url: `${resolveBaseUrl(this, options.baseUrl)}/messages`,
          method: 'POST',
          headers: this.headers(options.apiKey),
          body
        };
      },

      parseResponse(data) {
        const blocks = (data && data.content) || [];
        if (!Array.isArray(blocks)) return null;

        return blocks
          .filter((block) => block && block.type === 'text')
          .map((block) => block.text || '')
          .join('') || null;
      },

      parseError(data) {
        if (data && data.error && data.error.message) return data.error.message;
        return null;
      },

      listModelsRequest(options) {
        return {
          url: `${resolveBaseUrl(this, options.baseUrl)}/models?limit=100`,
          method: 'GET',
          headers: this.headers(options.apiKey)
        };
      },

      parseModels(data) {
        const items = (data && data.data) || [];
        return items.map((item) => item && item.id).filter(Boolean);
      },

      truncationHint(data) {
        return Boolean(data && data.stop_reason === 'max_tokens');
      }
    },

    openAiCompatible({
      id: 'openai',
      label: 'OpenAI',
      defaultBaseUrl: 'https://api.openai.com/v1',
      origins: ['https://api.openai.com/*'],
      defaultModel: 'gpt-4o-mini',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini', 'gpt-5'],
      keyPrefix: 'sk-',
      keyPlaceholder: 'sk-...',
      docsUrl: 'https://platform.openai.com/api-keys',
      docsLabel: 'OpenAI dashboard'
    }),

    openAiCompatible({
      id: 'openrouter',
      label: 'OpenRouter',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      origins: ['https://openrouter.ai/*'],
      defaultModel: 'openai/gpt-4o-mini',
      models: [
        'openai/gpt-4o-mini',
        'anthropic/claude-sonnet-5',
        'google/gemini-3.5-flash',
        'meta-llama/llama-3.3-70b-instruct',
        'deepseek/deepseek-chat'
      ],
      retiredModels: {
        'google/gemini-2.0-flash-001': 'google/gemini-3.5-flash',
        'google/gemini-2.0-flash-lite-001': 'google/gemini-3.1-flash-lite'
      },
      keyPrefix: 'sk-or-',
      keyPlaceholder: 'sk-or-v1-...',
      docsUrl: 'https://openrouter.ai/keys',
      docsLabel: 'OpenRouter keys',
      extraHeaders: {
        'HTTP-Referer': 'https://github.com/silham/WhatsApp-Web-AI-Assistant',
        'X-Title': 'WhatsApp Web AI Assistant'
      }
    }),

    openAiCompatible({
      id: 'groq',
      label: 'Groq',
      defaultBaseUrl: 'https://api.groq.com/openai/v1',
      origins: ['https://api.groq.com/*'],
      defaultModel: 'llama-3.3-70b-versatile',
      models: [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'openai/gpt-oss-120b',
        'moonshotai/kimi-k2-instruct'
      ],
      keyPrefix: 'gsk_',
      keyPlaceholder: 'gsk_...',
      docsUrl: 'https://console.groq.com/keys',
      docsLabel: 'Groq console'
    }),

    openAiCompatible({
      id: 'deepseek',
      label: 'DeepSeek',
      defaultBaseUrl: 'https://api.deepseek.com/v1',
      origins: ['https://api.deepseek.com/*'],
      defaultModel: 'deepseek-chat',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      keyPrefix: 'sk-',
      keyPlaceholder: 'sk-...',
      docsUrl: 'https://platform.deepseek.com/api_keys',
      docsLabel: 'DeepSeek platform'
    }),

    openAiCompatible({
      id: 'mistral',
      label: 'Mistral AI',
      defaultBaseUrl: 'https://api.mistral.ai/v1',
      origins: ['https://api.mistral.ai/*'],
      defaultModel: 'mistral-small-latest',
      models: ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'],
      keyPlaceholder: 'Your Mistral API key',
      docsUrl: 'https://console.mistral.ai/api-keys',
      docsLabel: 'Mistral console'
    }),

    openAiCompatible({
      id: 'xai',
      label: 'xAI Grok',
      defaultBaseUrl: 'https://api.x.ai/v1',
      origins: ['https://api.x.ai/*'],
      defaultModel: 'grok-3',
      models: ['grok-4', 'grok-3', 'grok-3-mini'],
      keyPrefix: 'xai-',
      keyPlaceholder: 'xai-...',
      docsUrl: 'https://console.x.ai/',
      docsLabel: 'xAI console'
    }),

    openAiCompatible({
      id: 'ollama',
      label: 'Ollama (local)',
      requiresKey: false,
      defaultBaseUrl: 'http://localhost:11434/v1',
      origins: ['http://localhost/*', 'http://127.0.0.1/*'],
      defaultModel: 'llama3.1',
      models: ['llama3.1', 'llama3.2', 'qwen2.5', 'mistral', 'phi4'],
      keyPlaceholder: 'Not required for a local Ollama',
      docsUrl: 'https://ollama.com/download',
      docsLabel: 'Ollama',
      hint: 'Start Ollama with OLLAMA_ORIGINS=* so the extension is allowed to reach it.'
    }),

    openAiCompatible({
      id: 'custom',
      label: 'Custom (OpenAI-compatible)',
      requiresKey: false,
      defaultBaseUrl: '',
      origins: [],
      defaultModel: '',
      models: [],
      keyPlaceholder: 'API key, if your endpoint needs one',
      hint: 'Any endpoint exposing /chat/completions - LM Studio, vLLM, Together, ' +
        'Fireworks, an Azure OpenAI gateway, or your own proxy.',
      docsUrl: '',
      docsLabel: ''
    })
  ];

  const BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

  const DEFAULT_PROVIDER_ID = 'gemini';

  function get(providerId) {
    return BY_ID.get(providerId) || BY_ID.get(DEFAULT_PROVIDER_ID);
  }

  function list() {
    return PROVIDERS.slice();
  }

  /** Every origin the manifest has to allow for the built-in providers. */
  function allOrigins() {
    const origins = new Set();
    for (const provider of PROVIDERS) {
      for (const origin of provider.origins || []) origins.add(origin);
    }
    return Array.from(origins);
  }

  /**
   * A cheap sanity check on a pasted key, so an obvious paste error is caught
   * before it costs a round trip. Unknown-shaped keys are allowed through -
   * vendors change their prefixes, and a false rejection is worse than a 401.
   */
  function validateKey(providerId, apiKey) {
    const provider = get(providerId);
    const key = String(apiKey || '').trim();

    if (!key) {
      return provider.requiresKey
        ? { valid: false, message: `${provider.label} needs an API key` }
        : { valid: true };
    }

    if (provider.keyPrefix && !key.startsWith(provider.keyPrefix)) {
      return {
        valid: false,
        message: `That does not look like a ${provider.label} key - it should start with "${provider.keyPrefix}"`
      };
    }

    return { valid: true };
  }

  /** Everything the background worker needs to perform one generation. */
  function buildRequest(providerId, options) {
    const provider = get(providerId);
    const request = provider.buildRequest({
      apiKey: String(options.apiKey || '').trim(),
      model: resolveModel(provider.id, options.model),
      baseUrl: options.baseUrl,
      systemPrompt: options.systemPrompt,
      userPrompt: options.userPrompt,
      maxTokens: options.maxTokens || DEFAULT_MAX_TOKENS,
      temperature: typeof options.temperature === 'number' ? options.temperature : DEFAULT_TEMPERATURE
    });

    return request;
  }

  function buildListModelsRequest(providerId, options) {
    const provider = get(providerId);
    if (typeof provider.listModelsRequest !== 'function') return null;

    const baseUrl = resolveBaseUrl(provider, options.baseUrl);
    if (!baseUrl) return null;

    return provider.listModelsRequest({
      apiKey: String(options.apiKey || '').trim(),
      baseUrl
    });
  }

  /**
   * Turns a provider response into text, or throws with a message the user can
   * act on. Kept here rather than in the worker so the vendor-shaped quirks -
   * an empty candidate, a truncated completion - stay next to the adapter.
   */
  function extractText(providerId, data) {
    const provider = get(providerId);
    const text = provider.parseResponse(data);

    if (text && text.trim()) return text.trim();

    if (typeof provider.truncationHint === 'function' && provider.truncationHint(data)) {
      throw new Error(
        'The reply was cut off before any text came back. Try a shorter conversation or shorter instructions.'
      );
    }

    const refusal = provider.parseError(data);
    throw new Error(refusal || 'The model returned an empty response');
  }

  function describeError(providerId, status, data) {
    const provider = get(providerId);
    const detail = provider.parseError(data);

    const byStatus = {
      400: 'The request was rejected. Check the model name in settings.',
      401: `${provider.label} rejected the API key. Check it in settings.`,
      403: `${provider.label} denied access. Check the key's permissions or billing.`,
      404: 'Endpoint or model not found. Check the model name and base URL in settings.',
      413: 'The conversation is too long for this model. Export fewer messages.',
      429: 'Rate limit or quota exceeded. Wait a moment and try again.'
    };

    const summary = byStatus[status] || (status >= 500
      ? `${provider.label} is having trouble right now (HTTP ${status}).`
      : `${provider.label} returned HTTP ${status}.`);

    return detail ? `${summary} (${detail})` : summary;
  }

  /**
   * The replacement for a model the vendor has withdrawn, or null when the
   * model is still current. Retirements are the one case where a stored
   * choice is overridden - the alternative is every request failing with a
   * 404 until the user notices the model picker.
   */
  function retiredReplacement(providerId, model) {
    const name = String(model || '').trim();
    if (!name) return null;
    const retired = get(providerId).retiredModels || {};
    return Object.prototype.hasOwnProperty.call(retired, name) ? retired[name] : null;
  }

  function resolveModel(providerId, model) {
    const provider = get(providerId);
    const name = String(model || '').trim() || provider.defaultModel;
    return retiredReplacement(provider.id, name) || name;
  }

  return {
    DEFAULT_PROVIDER_ID,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    list,
    get,
    allOrigins,
    resolveBaseUrl: (providerId, baseUrl) => resolveBaseUrl(get(providerId), baseUrl),
    resolveModel,
    retiredReplacement,
    validateKey,
    buildRequest,
    buildListModelsRequest,
    extractText,
    describeError
  };
});
