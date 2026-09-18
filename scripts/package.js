#!/usr/bin/env node
'use strict';

/**
 * Stages the shipped extension files into dist/ and zips them for upload to
 * the Chrome Web Store.
 *
 * Only the files the extension actually needs are copied - tests, CI config
 * and node_modules stay out of the bundle. If the `zip` command is missing
 * (typically on Windows) the staged folder is left in place, which "Load
 * unpacked" accepts as-is.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

/** Everything that ships, relative to the repository root. */
const INCLUDED = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'help.html',
  'help.js',
  'styles.css',
  'lib',
  '_locales',
  'LICENSE',
  'README.md'
];

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const distDir = path.join(ROOT, 'dist');
const stageName = `${pkg.name}-${pkg.version}`;
const stageDir = path.join(distDir, stageName);
const zipPath = path.join(distDir, `${stageName}.zip`);

fs.rmSync(stageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const entry of INCLUDED) {
  const source = path.join(ROOT, entry);
  if (!fs.existsSync(source)) {
    console.error(`cannot package: "${entry}" is missing`);
    process.exit(1);
  }
  fs.cpSync(source, path.join(stageDir, entry), { recursive: true });
}

// Zip the staged contents, not the folder itself: the Chrome Web Store
// requires manifest.json to sit at the root of the archive.
const zip = spawnSync('zip', ['-rq', zipPath, '.'], { cwd: stageDir, stdio: 'inherit' });

if (zip.error || zip.status !== 0) {
  console.log(`Staged unpacked extension at dist/${stageName}`);
  console.log('The "zip" command was unavailable, so no archive was created.');
  process.exit(0);
}

const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`Packaged dist/${stageName}.zip (${sizeKb} KB)`);
