'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const I18n = require('../lib/i18n.js');

test.afterEach(() => {
  // The module keeps one active locale; tests must not leak it into each other.
  I18n.setLocale(I18n.DEFAULT_LOCALE);
});

test('every locale defines the same keys as the default one', () => {
  const expected = Object.keys(I18n.MESSAGES[I18n.DEFAULT_LOCALE]).sort();

  for (const locale of Object.keys(I18n.MESSAGES)) {
    if (locale === I18n.DEFAULT_LOCALE) continue;

    const actual = Object.keys(I18n.MESSAGES[locale]).sort();
    const missing = expected.filter((key) => !actual.includes(key));
    const extra = actual.filter((key) => !expected.includes(key));

    assert.deepEqual(missing, [], `${locale} is missing keys`);
    assert.deepEqual(extra, [], `${locale} has keys the default locale does not`);
  }
});

test('every locale offered in the picker has a translation', () => {
  for (const locale of I18n.LOCALES) {
    assert.ok(
      I18n.MESSAGES[locale.code],
      `the picker offers "${locale.code}" but there are no messages for it`
    );
    assert.ok(locale.native, `"${locale.code}" has no native name to show`);
  }
});

test('a translated string keeps the placeholders of the original', () => {
  const source = I18n.MESSAGES[I18n.DEFAULT_LOCALE];
  const names = (value) => (value.match(/\{\w+\}/g) || []).sort();

  for (const locale of Object.keys(I18n.MESSAGES)) {
    if (locale === I18n.DEFAULT_LOCALE) continue;

    for (const [key, value] of Object.entries(I18n.MESSAGES[locale])) {
      assert.deepEqual(
        names(value),
        names(source[key]),
        `${locale}/${key} does not use the same placeholders as the English string`
      );
    }
  }
});

test('normalize matches a region tag to its base language', () => {
  assert.equal(I18n.normalize('ta'), 'ta');
  assert.equal(I18n.normalize('ta-LK'), 'ta');
  assert.equal(I18n.normalize('TA-IN'), 'ta');
  assert.equal(I18n.normalize('en-GB'), 'en');
});

test('normalize falls back to the default locale for anything unknown', () => {
  assert.equal(I18n.normalize('kl'), 'en');
  assert.equal(I18n.normalize(''), 'en');
  assert.equal(I18n.normalize(undefined), 'en');
  assert.equal(I18n.normalize(null), 'en');
});

test('t returns the string for the active locale', () => {
  I18n.setLocale('ta');
  assert.equal(I18n.t('menu.settings'), I18n.MESSAGES.ta['menu.settings']);
  assert.notEqual(I18n.t('menu.settings'), I18n.MESSAGES.en['menu.settings']);
});

test('t substitutes named placeholders', () => {
  assert.equal(
    I18n.t('notify.testing', { provider: 'Groq' }),
    'Testing Groq...'
  );
  assert.equal(
    I18n.t('fab.titleCached', { count: 42 }),
    'AI Assistant (42 cached)'
  );
});

test('t leaves a placeholder alone when no value is given for it', () => {
  assert.equal(I18n.t('notify.testing', {}), 'Testing {provider}...');
});

test('t falls back to English rather than rendering nothing', () => {
  const original = I18n.MESSAGES.ta['menu.settings'];
  delete I18n.MESSAGES.ta['menu.settings'];

  try {
    I18n.setLocale('ta');
    assert.equal(I18n.t('menu.settings'), I18n.MESSAGES.en['menu.settings']);
  } finally {
    I18n.MESSAGES.ta['menu.settings'] = original;
  }
});

test('t returns the key itself when no locale defines it', () => {
  assert.equal(I18n.t('no.such.key'), 'no.such.key');
});

test('the reply-language directive names the language in English', () => {
  const directive = I18n.replyLanguageDirective('ta');

  assert.match(directive, /Tamil/);
  assert.match(directive, /not a romanised transliteration|romanised/);
});

test('the reply-language directive is empty for auto and for unknown codes', () => {
  assert.equal(I18n.replyLanguageDirective('auto'), '');
  assert.equal(I18n.replyLanguageDirective('kl'), '');
  assert.equal(I18n.replyLanguageDirective(undefined), '');
});

test('every reply language except auto has a prompt name and a native name', () => {
  for (const language of I18n.REPLY_LANGUAGES) {
    if (language.code === 'auto') continue;

    assert.ok(language.prompt, `${language.code} has no English name for the prompt`);
    assert.ok(language.native, `${language.code} has no native name for the picker`);
  }
});

test('Tamil is offered both as an interface locale and as a reply language', () => {
  assert.ok(I18n.LOCALES.some((locale) => locale.code === 'ta'));
  assert.ok(I18n.REPLY_LANGUAGES.some((language) => language.code === 'ta'));
});
