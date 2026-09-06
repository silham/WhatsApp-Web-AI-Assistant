#!/usr/bin/env node
'use strict';

/**
 * Validates manifest.json before the extension is packaged or published.
 *
 * Catches the mistakes that are invisible until Chrome refuses to load the
 * extension: a file renamed without updating the manifest, or a release tagged
 * with a version that does not match package.json.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    fail(`${relativePath} could not be read as JSON: ${error.message}`);
    return null;
  }
}

/** Record every path the manifest points at, so we can check they all exist. */
function collectReferencedFiles(manifest) {
  const referenced = new Set();
  const add = (file) => {
    if (typeof file === 'string' && !file.includes('*')) referenced.add(file);
  };

  for (const script of manifest.content_scripts || []) {
    (script.js || []).forEach(add);
    (script.css || []).forEach(add);
  }

  add(manifest.background && manifest.background.service_worker);
  add(manifest.action && manifest.action.default_popup);
  add(manifest.options_page);
  Object.values(manifest.icons || {}).forEach(add);
  Object.values((manifest.action && manifest.action.default_icon) || {}).forEach(add);

  for (const entry of manifest.web_accessible_resources || []) {
    (entry.resources || []).forEach(add);
  }

  return referenced;
}

const manifest = readJson('manifest.json');
const pkg = readJson('package.json');

if (manifest && pkg) {
  if (manifest.manifest_version !== 3) {
    fail(`manifest_version should be 3, found ${JSON.stringify(manifest.manifest_version)}`);
  }

  for (const field of ['name', 'version', 'description']) {
    if (!manifest[field]) fail(`manifest.json is missing the "${field}" field`);
  }

  if (manifest.version && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    fail(`manifest version "${manifest.version}" is not a valid Chrome version string`);
  }

  if (manifest.version !== pkg.version) {
    fail(
      `version mismatch: manifest.json is ${manifest.version}, ` +
      `package.json is ${pkg.version} - keep them in step`
    );
  }

  for (const file of collectReferencedFiles(manifest)) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      fail(`manifest.json references "${file}", which does not exist`);
    }
  }

  checkLocales(manifest);
}

/**
 * Every __MSG_key__ in the manifest has to resolve in the default locale, and
 * every other locale has to define the same keys - a missing one makes Chrome
 * reject the whole extension at load time with a message that names neither the
 * key nor the file.
 */
function checkLocales(manifest) {
  const placeholders = new Set();
  const scan = (value) => {
    if (typeof value === 'string') {
      const match = /^__MSG_(\w+)__$/.exec(value);
      if (match) placeholders.add(match[1]);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scan);
    }
  };
  scan(manifest);

  if (placeholders.size === 0) return;

  if (!manifest.default_locale) {
    fail('manifest.json uses __MSG_ placeholders but has no "default_locale"');
    return;
  }

  const localesDir = path.join(ROOT, '_locales');
  if (!fs.existsSync(localesDir)) {
    fail('manifest.json sets "default_locale" but there is no _locales/ directory');
    return;
  }

  const locales = fs.readdirSync(localesDir).filter((entry) =>
    fs.statSync(path.join(localesDir, entry)).isDirectory()
  );

  if (!locales.includes(manifest.default_locale)) {
    fail(`default_locale is "${manifest.default_locale}" but _locales/${manifest.default_locale}/ is missing`);
  }

  for (const locale of locales) {
    const messages = readJson(path.join('_locales', locale, 'messages.json'));
    if (!messages) continue;

    for (const key of placeholders) {
      if (!messages[key] || typeof messages[key].message !== 'string') {
        fail(`_locales/${locale}/messages.json is missing the "${key}" message`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('manifest check failed:\n');
  for (const error of errors) console.error(`  - ${error}`);
  console.error('');
  process.exit(1);
}

// manifest.name is a __MSG_ placeholder now, so report the resolved one.
const defaultMessages = manifest.default_locale
  ? readJson(path.join('_locales', manifest.default_locale, 'messages.json'))
  : null;
const displayName = (defaultMessages && defaultMessages.extName && defaultMessages.extName.message) ||
  manifest.name;

console.log(`manifest check passed (${displayName} v${manifest.version})`);
