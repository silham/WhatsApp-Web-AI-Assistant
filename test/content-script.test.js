'use strict';

/**
 * Loads the content scripts the way Chrome does - in one shared isolated world,
 * in the order manifest.json lists them - and checks the wiring holds.
 *
 * This is a smoke test, not a test of the UI: it guards against `lib/` files
 * being reordered, renamed or dropped from the manifest, which would leave
 * content.js referencing a global that no longer exists.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const contentScript = manifest.content_scripts[0];

/** A DOM and chrome.* stub just deep enough for the scripts to finish loading. */
function createIsolatedWorld() {
  const noop = () => {};
  const element = {
    classList: { contains: () => false, add: noop, remove: noop },
    style: {},
    textContent: '',
    parentElement: null,
    appendChild: noop,
    removeChild: noop,
    addEventListener: noop,
    setAttribute: noop,
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false
  };

  const document = {
    readyState: 'complete',
    body: element,
    documentElement: element,
    createElement: () => ({ ...element }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
    getElementById: () => null
  };

  const sent = [];
  const chrome = {
    storage: {
      sync: { get: async () => ({}), set: async () => {}, remove: async () => {} },
      local: { get: async () => ({}), set: async () => {} }
    },
    runtime: {
      // A live extension context always has an id; the content script reads it
      // to tell itself apart from a copy orphaned by an extension reload.
      id: 'test-extension-id',
      onMessage: { addListener: noop },
      getURL: (p) => p,
      // Every provider call goes through the background worker; record them.
      sendMessage: async (message) => {
        sent.push(message);
        if (message.action === 'checkHostPermission') return { granted: true };
        return { ok: true, text: 'Generated reply' };
      }
    },
    tabs: { query: noop, sendMessage: noop }
  };
  chrome.runtime.sent = sent;

  const sandbox = {
    document,
    chrome,
    console: { log: noop, warn: noop, error: noop },
    setTimeout: () => 0,
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    Intl,
    MutationObserver: class { observe() {} disconnect() {} },
    location: { href: 'https://web.whatsapp.com/' },
    navigator: { clipboard: { writeText: async () => {} } }
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  return vm.createContext(sandbox);
}

test('the manifest lists lib/timestamps.js before content.js', () => {
  const files = contentScript.js;
  assert.ok(
    files.indexOf('lib/timestamps.js') !== -1,
    'lib/timestamps.js must be registered as a content script'
  );
  assert.ok(
    files.indexOf('lib/timestamps.js') < files.indexOf('content.js'),
    'lib/timestamps.js must load before content.js, which depends on it'
  );
});

test('background.js injects the same files, in the same order', () => {
  const background = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  for (const file of contentScript.js) {
    assert.ok(
      background.includes(`'${file}'`),
      `background.js should inject ${file}, matching manifest.json`
    );
  }
});

test('the content scripts load together and expose the timestamp helpers', () => {
  const context = createIsolatedWorld();

  for (const file of contentScript.js) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }

  assert.equal(typeof context.WhatsAppTimestamps, 'object');
  assert.equal(typeof context.WhatsAppTimestamps.sortMessagesChronologically, 'function');
  assert.ok(context.whatsappAI, 'content.js should have instantiated WhatsAppAI');
});

test('the assistant delegates sorting to the shared module', () => {
  const context = createIsolatedWorld();

  for (const file of contentScript.js) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }

  const sorted = context.whatsappAI.sortMessagesChronologically([
    { timestamp: '2:27 PM, 8/21/2026', text: 'later' },
    { timestamp: '12:59 AM, 7/29/2026', text: 'earlier' }
  ]);

  assert.deepEqual(sorted.map((m) => m.text), ['earlier', 'later']);
});

test('the assistant asks the background worker instead of fetching itself', async () => {
  const context = createIsolatedWorld();

  for (const file of contentScript.js) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }

  const text = await context.whatsappAI.callProvider('Alice: hi');
  assert.equal(text, 'Generated reply');

  const request = context.chrome.runtime.sent.find((m) => m.action === 'generateResponse');
  assert.ok(request, 'the content script should message the worker, not call fetch');
  assert.equal(request.data.provider, 'gemini', 'a fresh profile falls back to the default provider');
  assert.ok(request.data.systemPrompt, 'the system instructions should travel as their own field');
  assert.match(request.data.userPrompt, /Alice: hi/);
});

test('a worker error surfaces as a message the user can read', async () => {
  const context = createIsolatedWorld();
  context.chrome.runtime.sendMessage = async () => ({ ok: false, error: 'OpenAI rejected the API key.' });

  for (const file of contentScript.js) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }

  await assert.rejects(
    () => context.whatsappAI.callProvider('Alice: hi'),
    /rejected the API key/
  );
});

/** A fresh isolated world with the content script already evaluated in it. */
function loadedWorld() {
  const context = createIsolatedWorld();
  for (const file of contentScript.js) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

test("an orphaned content script asks the user to reload, not Chrome's raw error", async () => {
  const context = loadedWorld();

  // What an extension reload does to the copy already injected in the tab.
  delete context.chrome.runtime.id;

  await assert.rejects(
    () => context.whatsappAI.callProvider('Alice: hi'),
    /Refresh this page/,
    '"Extension context invalidated" is not something a user can act on'
  );
});

test('a context lost mid-flight is translated too', async () => {
  const context = loadedWorld();
  context.chrome.runtime.sendMessage = async () => {
    throw new Error('Extension context invalidated.');
  };

  await assert.rejects(() => context.whatsappAI.callProvider('Alice: hi'), /Refresh this page/);
});
