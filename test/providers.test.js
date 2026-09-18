'use strict';

/**
 * Checks each provider adapter against the shape its vendor actually speaks.
 *
 * The adapters are the one place where a typo is invisible until a user pastes
 * a key and gets a 404, so every one is exercised: the URL it builds, where the
 * key is carried, and that it can find the text in a realistic response body.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const providers = require('../lib/providers.js');

const ROOT = path.resolve(__dirname, '..');

const PROMPT = {
  apiKey: 'test-key',
  systemPrompt: 'Be brief.',
  userPrompt: 'Say hello.'
};

test('every provider builds an absolute URL and carries the key', () => {
  for (const provider of providers.list()) {
    // The custom provider has no host of its own; the user supplies one.
    const baseUrl = provider.defaultBaseUrl || 'https://example.test/v1';
    const request = providers.buildRequest(provider.id, Object.assign({ baseUrl }, PROMPT));

    assert.doesNotThrow(
      () => new URL(request.url),
      `${provider.id} should build an absolute URL, got "${request.url}"`
    );
    assert.equal(request.method, 'POST', `${provider.id} should POST its prompt`);

    const carriesKey = Object.values(request.headers).some((value) => String(value).includes('test-key'));
    assert.ok(carriesKey, `${provider.id} should send the API key in a header`);

    assert.ok(request.body, `${provider.id} should send a body`);
  }
});

test('the key never travels in the URL, where it would end up in logs', () => {
  for (const provider of providers.list()) {
    const baseUrl = provider.defaultBaseUrl || 'https://example.test/v1';
    const request = providers.buildRequest(provider.id, Object.assign({ baseUrl }, PROMPT));
    assert.ok(
      !request.url.includes('test-key'),
      `${provider.id} puts the API key in the URL`
    );
  }
});

test('every provider passes the system instructions along', () => {
  for (const provider of providers.list()) {
    const baseUrl = provider.defaultBaseUrl || 'https://example.test/v1';
    const request = providers.buildRequest(provider.id, Object.assign({ baseUrl }, PROMPT));
    assert.ok(
      JSON.stringify(request.body).includes('Be brief.'),
      `${provider.id} drops the system instructions`
    );
  }
});

test('gemini: the model goes in the path and the key in a header', () => {
  const request = providers.buildRequest('gemini', Object.assign({ model: 'gemini-2.5-flash' }, PROMPT));

  assert.equal(
    request.url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  );
  assert.equal(request.headers['x-goog-api-key'], 'test-key');
  assert.equal(request.body.systemInstruction.parts[0].text, 'Be brief.');
  assert.equal(request.body.contents[0].parts[0].text, 'Say hello.');
});

test('gemini: reads the text out of a candidate', () => {
  const text = providers.extractText('gemini', {
    candidates: [{ content: { parts: [{ text: 'Hi there' }] } }]
  });
  assert.equal(text, 'Hi there');
});

test('anthropic: uses x-api-key, a version header and top-level system', () => {
  const request = providers.buildRequest('anthropic', Object.assign({ model: 'claude-sonnet-5' }, PROMPT));

  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.headers['x-api-key'], 'test-key');
  assert.equal(request.headers['anthropic-version'], '2023-06-01');
  assert.equal(request.body.system, 'Be brief.');
  assert.equal(request.body.model, 'claude-sonnet-5');
  assert.ok(request.body.max_tokens > 0, 'anthropic requires max_tokens');
});

test('anthropic: joins the text blocks and ignores the others', () => {
  const text = providers.extractText('anthropic', {
    content: [
      { type: 'thinking', thinking: 'hmm' },
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' there' }
    ]
  });
  assert.equal(text, 'Hello there');
});

test('the OpenAI-compatible providers all post chat completions with a bearer token', () => {
  for (const id of ['openai', 'openrouter', 'groq', 'deepseek', 'mistral', 'xai', 'ollama']) {
    const request = providers.buildRequest(id, PROMPT);

    assert.ok(
      request.url.endsWith('/chat/completions'),
      `${id} should post to /chat/completions, got ${request.url}`
    );
    assert.equal(request.headers.Authorization, 'Bearer test-key');
    assert.deepEqual(request.body.messages[0], { role: 'system', content: 'Be brief.' });
    assert.deepEqual(request.body.messages[1], { role: 'user', content: 'Say hello.' });
  }
});

test('openai: reads a plain string and an array of content parts', () => {
  assert.equal(
    providers.extractText('openai', { choices: [{ message: { content: 'Hello' } }] }),
    'Hello'
  );
  assert.equal(
    providers.extractText('openai', {
      choices: [{ message: { content: [{ type: 'text', text: 'Hel' }, { type: 'text', text: 'lo' }] } }]
    }),
    'Hello'
  );
});

test('a custom endpoint uses the base URL the user supplied', () => {
  const request = providers.buildRequest('custom', Object.assign({
    baseUrl: 'http://localhost:1234/v1/',
    model: 'local-model'
  }, PROMPT));

  // The trailing slash must not survive into the path.
  assert.equal(request.url, 'http://localhost:1234/v1/chat/completions');
  assert.equal(request.body.model, 'local-model');
});

test('an unknown provider id falls back to the default rather than throwing', () => {
  assert.equal(providers.get('not-a-provider').id, providers.DEFAULT_PROVIDER_ID);
});

test('a truncated reply with no text is reported as truncation, not as empty', () => {
  assert.throws(
    () => providers.extractText('gemini', { candidates: [{ finishReason: 'MAX_TOKENS', content: {} }] }),
    /cut off/
  );
  assert.throws(
    () => providers.extractText('openai', { choices: [{ finish_reason: 'length', message: {} }] }),
    /cut off/
  );
});

test('errors name the provider and quote its own message', () => {
  const message = providers.describeError('openai', 401, { error: { message: 'Incorrect API key' } });
  assert.match(message, /OpenAI/);
  assert.match(message, /Incorrect API key/);
});

test('an error body the provider did not explain still produces advice', () => {
  assert.match(providers.describeError('groq', 429, null), /Rate limit/);
  assert.match(providers.describeError('groq', 503, null), /trouble right now/);
});

test('key validation catches an obvious paste error but allows unknown shapes', () => {
  assert.equal(providers.validateKey('gemini', 'AIzaSyExample').valid, true);
  assert.equal(providers.validateKey('gemini', 'sk-oops').valid, false);

  // Mistral has no documented prefix, so anything non-empty is accepted.
  assert.equal(providers.validateKey('mistral', 'whatever').valid, true);
});

test('a missing key is only an error for providers that need one', () => {
  assert.equal(providers.validateKey('openai', '').valid, false);
  assert.equal(providers.validateKey('ollama', '').valid, true);
});

test('the manifest allows every host the built-in providers use', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const allowed = new Set(manifest.host_permissions);

  for (const provider of providers.list()) {
    for (const origin of provider.origins || []) {
      // Local and custom hosts are granted at runtime from the popup instead.
      if (origin.startsWith('http://')) continue;

      assert.ok(
        allowed.has(origin),
        `manifest.json is missing "${origin}", needed by ${provider.id}`
      );
    }
  }
});

test('a provider that can list models can also parse the list back', () => {
  const openai = providers.buildListModelsRequest('openai', { apiKey: 'test-key' });
  assert.equal(openai.url, 'https://api.openai.com/v1/models');
  assert.deepEqual(
    providers.get('openai').parseModels({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }),
    ['gpt-4o', 'gpt-4o-mini']
  );

  assert.deepEqual(
    providers.get('gemini').parseModels({
      models: [
        { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
      ]
    }),
    ['gemini-3.5-flash']
  );
});

test('a withdrawn model resolves to its replacement, not to a 404', () => {
  // Google shut gemini-2.0-flash down on 2026-06-01; it was our old default.
  assert.equal(providers.resolveModel('gemini', 'gemini-2.0-flash'), 'gemini-3.5-flash');
  assert.equal(providers.resolveModel('gemini', 'gemini-2.0-flash-lite'), 'gemini-3.1-flash-lite');
  assert.equal(
    providers.resolveModel('openrouter', 'google/gemini-2.0-flash-001'),
    'google/gemini-3.5-flash'
  );

  // A current model, and an empty choice, are left to the normal path.
  assert.equal(providers.resolveModel('gemini', 'gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(providers.resolveModel('gemini', ''), providers.get('gemini').defaultModel);
  assert.equal(providers.retiredReplacement('gemini', 'gemini-2.5-pro'), null);
  assert.equal(providers.retiredReplacement('gemini', ''), null);
});

test('the default model and the offered list are all current', () => {
  const gemini = providers.get('gemini');
  const retired = Object.keys(gemini.retiredModels);

  assert.ok(!retired.includes(gemini.defaultModel), 'the default must not be a withdrawn model');
  gemini.models.forEach((model) => {
    assert.ok(!retired.includes(model), `${model} is withdrawn and should not be offered`);
  });
});

test('a withdrawn model goes out on the wire as its replacement', () => {
  const request = providers.buildRequest(
    'gemini',
    Object.assign({ model: 'gemini-2.0-flash' }, PROMPT)
  );

  assert.ok(
    request.url.includes('models/gemini-3.5-flash:generateContent'),
    `expected the replacement model in ${request.url}`
  );
});

test('a custom provider with no base URL cannot be asked for its models', () => {
  assert.equal(providers.buildListModelsRequest('custom', { apiKey: '' }), null);
});
