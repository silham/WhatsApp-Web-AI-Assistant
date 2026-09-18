'use strict';

const globals = require('globals');

/** Files that make up the shipped extension, as listed in manifest.json. */
const EXTENSION_FILES = ['content.js', 'background.js', 'popup.js', 'help.js', 'lib/**/*.js'];

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**']
  },
  {
    // Shared rules for every file in the repository
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: globals.node
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      curly: ['error', 'multi-line'],
      'no-implicit-globals': 'off',
      'no-console': 'off'
    }
  },
  {
    // The extension runs in the browser with the chrome.* APIs available
    files: EXTENSION_FILES,
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        // Attached to the isolated world by the modules in lib/
        WhatsAppTimestamps: 'readonly',
        LLMProviders: 'readonly',
        AISettings: 'readonly',
        I18n: 'readonly',
        // background.js runs as a service worker
        importScripts: 'readonly'
      }
    }
  }
];
