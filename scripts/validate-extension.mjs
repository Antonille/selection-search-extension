#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'manifest.json',
  'background.js',
  'options.html',
  'options.js',
  'options.css',
  'providers.default.json'
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertExists(relPath) {
  const full = path.join(root, relPath);
  if (!fs.existsSync(full)) {
    fail(`Missing required file: ${relPath}`);
  }
}

for (const rel of requiredFiles) {
  assertExists(rel);
}

const manifestPath = path.join(root, 'manifest.json');
const manifest = readJson(manifestPath);

if (manifest.manifest_version !== 3) {
  fail('manifest.json must use Manifest V3.');
}

if (!Array.isArray(manifest.permissions)) {
  fail('manifest.json should contain a permissions array.');
}

if (!manifest.background || manifest.background.service_worker !== 'background.js') {
  fail('manifest.json should point background.service_worker to background.js.');
}

if (!manifest.options_ui || manifest.options_ui.page !== 'options.html') {
  fail('manifest.json should point options_ui.page to options.html.');
}

const defaultsPath = path.join(root, 'providers.default.json');
const defaults = readJson(defaultsPath);

const isObject = defaults && typeof defaults === 'object' && !Array.isArray(defaults);
const supportsProviders = Array.isArray(defaults) || (isObject && Array.isArray(defaults.providers));
const supportsFinalists = isObject && Array.isArray(defaults.finalists);

if (!supportsProviders && !supportsFinalists) {
  fail('providers.default.json must be an array, an object with providers, or an object with finalists.');
}

const backgroundPath = path.join(root, 'background.js');
const backgroundJs = fs.readFileSync(backgroundPath, 'utf8');
if (!backgroundJs.includes('chrome.contextMenus')) {
  fail('background.js does not appear to use chrome.contextMenus.');
}
if (!backgroundJs.includes('chrome.storage')) {
  fail('background.js does not appear to use chrome.storage.');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Extension validation passed.');
