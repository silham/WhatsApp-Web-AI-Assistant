// Background service worker for WhatsApp AI Assistant
//
// Every call to a language model is made from here rather than from the content
// script. A content script's fetch is an ordinary cross-origin request from
// web.whatsapp.com, so it only reaches vendors that happen to send permissive
// CORS headers; the same fetch from the worker is covered by the manifest's
// host permissions and works for every provider.

importScripts('lib/providers.js');

/* global LLMProviders */

const CONTENT_SCRIPT_FILES = ['lib/i18n.js', 'lib/timestamps.js', 'lib/providers.js', 'lib/settings.js', 'content.js'];

chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp AI Assistant installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateResponse') {
    generate(request.data).then(sendResponse);
    return true; // keep the message channel open for the async reply
  }

  if (request.action === 'listModels') {
    listModels(request.data).then(sendResponse);
    return true;
  }

  if (request.action === 'checkHostPermission') {
    hasHostPermission(request.data).then((granted) => sendResponse({ granted }));
    return true;
  }

  sendResponse({ ok: true });
  return false;
});

/**
 * Sends one prompt to the configured provider and returns its text.
 *
 * Resolves rather than rejects on failure: the caller is a content script on
 * the other side of a message port, where a rejection would arrive as an opaque
 * channel error instead of something worth showing the user.
 */
async function generate(options) {
  try {
    const providerId = options.provider;
    const request = LLMProviders.buildRequest(providerId, options);
    const data = await send(request, providerId);
    return { ok: true, text: LLMProviders.extractText(providerId, data) };
  } catch (error) {
    console.error('Generation failed:', error);
    return { ok: false, error: error.message || 'Request failed' };
  }
}

/** Asks the provider which models the key can actually use. */
async function listModels(options) {
  try {
    const providerId = options.provider;
    const request = LLMProviders.buildListModelsRequest(providerId, options);
    if (!request) return { ok: false, error: 'This provider cannot list its models' };

    const data = await send(request, providerId);
    return { ok: true, models: LLMProviders.get(providerId).parseModels(data) };
  } catch (error) {
    return { ok: false, error: error.message || 'Could not list models' };
  }
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch (error) {
    return 'the provider';
  }
}

async function send(request, providerId) {
  let response;

  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body)
    });
  } catch (error) {
    // A DNS failure, an offline machine, or a host the manifest cannot reach.
    throw new Error(`Could not reach ${hostOf(request.url)}. Check your connection and the base URL in settings.`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(LLMProviders.describeError(providerId, response.status, data));
  }

  if (!data) throw new Error('The provider returned a response that was not JSON');

  return data;
}

/**
 * Custom and self-hosted endpoints are not in the manifest, so their access is
 * granted at runtime from the popup. The content script asks before it tries.
 */
async function hasHostPermission(options) {
  const url = String((options && options.baseUrl) || '').trim();
  if (!url) return true;

  try {
    const origin = `${new URL(url).origin}/*`;
    return await chrome.permissions.contains({ origins: [origin] });
  } catch (error) {
    return false;
  }
}

// Handle tab updates to inject content script
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
    try {
      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => window.whatsappAILoaded || false
      });

      const isAlreadyLoaded = results && results[0] && results[0].result;

      if (!isAlreadyLoaded) {
        // Inject content script only if not already loaded
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: CONTENT_SCRIPT_FILES
        });

        // Inject CSS
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['styles.css']
        });

        console.log('WhatsApp AI content script injected successfully');
      } else {
        console.log('WhatsApp AI already loaded on this tab');
      }
    } catch (err) {
      console.log('Error injecting content script:', err);
    }
  }
});
