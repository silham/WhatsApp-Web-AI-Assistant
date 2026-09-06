'use strict';

/**
 * Guards the storage layout, and in particular the upgrade path: an install
 * that has only ever known Gemini must keep working after the update without
 * the user re-pasting a key.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

require('../lib/providers.js');
const settings = require('../lib/settings.js');

test('a fresh install defaults to a provider and the stock instructions', () => {
  const loaded = settings.fromStored({});

  assert.equal(loaded.provider, 'gemini');
  assert.deepEqual(loaded.apiKeys, {});
  assert.equal(loaded.systemInstructions, settings.DEFAULT_SYSTEM_INSTRUCTIONS);
  assert.equal(loaded.migrated, false);
});

test('a 1.2.x install keeps its Gemini key', () => {
  const loaded = settings.fromStored({
    geminiApiKey: 'AIzaOld',
    systemInstructions: 'Be terse.'
  });

  assert.equal(loaded.provider, 'gemini');
  assert.equal(loaded.apiKeys.gemini, 'AIzaOld');
  assert.equal(loaded.systemInstructions, 'Be terse.');
  assert.equal(loaded.migrated, true, 'the caller has to know to write the new layout back');
});

test('a key already stored in the new layout wins over the legacy one', () => {
  const loaded = settings.fromStored({
    geminiApiKey: 'AIzaOld',
    aiApiKeys: { gemini: 'AIzaNew' }
  });

  assert.equal(loaded.apiKeys.gemini, 'AIzaNew');
  assert.equal(loaded.migrated, false);
});

test('a provider id that no longer exists falls back instead of breaking', () => {
  assert.equal(settings.fromStored({ aiProvider: 'retired-vendor' }).provider, 'gemini');
});

test('keys are kept per provider, so switching does not lose one', () => {
  const loaded = settings.fromStored({
    aiProvider: 'groq',
    aiApiKeys: { gemini: 'AIzaOne', groq: 'gsk_two' }
  });

  assert.equal(settings.activeConfig(loaded).apiKey, 'gsk_two');
  assert.equal(settings.activeConfig(loaded, 'gemini').apiKey, 'AIzaOne');
});

test('an unset model and base URL resolve to the provider defaults', () => {
  const config = settings.activeConfig(settings.fromStored({ aiProvider: 'openai' }));

  assert.equal(config.model, 'gpt-4o-mini');
  assert.equal(config.baseUrl, 'https://api.openai.com/v1');
});

test('an explicit model and base URL override the defaults', () => {
  const config = settings.activeConfig(settings.fromStored({
    aiProvider: 'openai',
    aiModels: { openai: 'gpt-4o' },
    aiBaseUrls: { openai: 'https://gateway.example/v1' }
  }));

  assert.equal(config.model, 'gpt-4o');
  assert.equal(config.baseUrl, 'https://gateway.example/v1');
});

test('what is written back can be read again unchanged', () => {
  const original = settings.fromStored({
    aiProvider: 'anthropic',
    aiApiKeys: { anthropic: 'sk-ant-x' },
    aiModels: { anthropic: 'claude-sonnet-5' },
    aiBaseUrls: {},
    systemInstructions: 'Reply in French.'
  });

  const roundTripped = settings.fromStored(settings.toStored(original));

  assert.equal(roundTripped.provider, original.provider);
  assert.deepEqual(roundTripped.apiKeys, original.apiKeys);
  assert.deepEqual(roundTripped.models, original.models);
  assert.equal(roundTripped.systemInstructions, original.systemInstructions);
  assert.equal(roundTripped.migrated, false, 'a saved profile must not re-trigger the migration');
});

test('corrupt storage is treated as empty rather than crashing the content script', () => {
  const loaded = settings.fromStored({ aiApiKeys: 'not-an-object', aiModels: null });

  assert.deepEqual(loaded.apiKeys, {});
  assert.deepEqual(loaded.models, {});
});

test('a fresh install starts in English with the reply language on auto', () => {
  const loaded = settings.fromStored({});

  assert.equal(loaded.uiLanguage, 'en');
  assert.equal(loaded.replyLanguage, settings.DEFAULT_REPLY_LANGUAGE);
});

test('a chosen interface language and reply language survive a round trip', () => {
  const stored = settings.toStored(
    settings.fromStored({ uiLanguage: 'ta', replyLanguage: 'ta' })
  );

  assert.equal(stored.uiLanguage, 'ta');
  assert.equal(stored.replyLanguage, 'ta');
  assert.equal(settings.fromStored(stored).uiLanguage, 'ta');
  assert.equal(settings.fromStored(stored).replyLanguage, 'ta');
});

test('a region tag stored as the interface language is folded to its base', () => {
  assert.equal(settings.fromStored({ uiLanguage: 'ta-LK' }).uiLanguage, 'ta');
});

test('a language that no longer exists falls back instead of breaking the UI', () => {
  const loaded = settings.fromStored({ uiLanguage: 'kl', replyLanguage: 'kl' });

  assert.equal(loaded.uiLanguage, 'en');
  assert.equal(loaded.replyLanguage, 'auto');
});

test('the interface language does not disturb the reply language', () => {
  const loaded = settings.fromStored({ uiLanguage: 'ta', replyLanguage: 'en' });

  assert.equal(loaded.uiLanguage, 'ta');
  assert.equal(loaded.replyLanguage, 'en', 'reading Tamil menus must not force Tamil replies');
});

test('a pinned model that the vendor withdrew is migrated to its replacement', () => {
  const stored = { aiModels: { gemini: 'gemini-2.0-flash', openai: 'gpt-4o-mini' } };
  const loaded = settings.fromStored(stored);

  assert.equal(loaded.models.gemini, 'gemini-3.5-flash');
  assert.equal(loaded.models.openai, 'gpt-4o-mini', 'a current model is left alone');
  assert.equal(loaded.migrated, true, 'the rewrite has to be persisted');
  assert.equal(stored.aiModels.gemini, 'gemini-2.0-flash', 'the stored object is not mutated');
});

test('a settings load with only current models is not flagged as migrated', () => {
  const loaded = settings.fromStored({ aiModels: { gemini: 'gemini-2.5-pro' } });

  assert.equal(loaded.models.gemini, 'gemini-2.5-pro');
  assert.equal(loaded.migrated, false);
});
