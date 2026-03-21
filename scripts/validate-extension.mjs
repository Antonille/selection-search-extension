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

let hadError = false;

function fail(message) {
  console.error(`ERROR: ${message}`);
  hadError = true;
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

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

for (const rel of requiredFiles) {
  assertExists(rel);
}

if (hadError) {
  process.exit(1);
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

const supportsProviders = Array.isArray(defaults) || (isPlainObject(defaults) && Array.isArray(defaults.providers));
const supportsFinalists = isPlainObject(defaults) && Array.isArray(defaults.finalists);
const supportsResourcesV2 = isPlainObject(defaults) && Array.isArray(defaults.resources);

if (!supportsProviders && !supportsFinalists && !supportsResourcesV2) {
  fail('providers.default.json must be an array, an object with providers, an object with finalists, or a v2 object with resources.');
}

if (supportsResourcesV2) {
  if (defaults.schema_version !== '2.0') {
    fail('v2 providers.default.json should declare schema_version "2.0".');
  }
  if (!isPlainObject(defaults.global_rules)) {
    fail('v2 providers.default.json should contain a global_rules object.');
  }

  for (const [index, resource] of defaults.resources.entries()) {
    if (!isPlainObject(resource)) {
      fail(`resources[${index}] must be an object.`);
      continue;
    }
    if (!resource.id || typeof resource.id !== 'string') {
      fail(`resources[${index}].id must be a non-empty string.`);
    }
    if (!isPlainObject(resource.menu)) {
      fail(`resources[${index}] must contain a menu object.`);
    }
    if (!isPlainObject(resource.url)) {
      fail(`resources[${index}] must contain a url object.`);
      continue;
    }
    if (!resource.url.template || typeof resource.url.template !== 'string') {
      fail(`resources[${index}].url.template must be a string.`);
    }

    const placeholders = resource.url.placeholders;
    if (placeholders !== undefined) {
      const placeholdersAreArray = Array.isArray(placeholders);
      const placeholdersAreObject = isPlainObject(placeholders);
      if (!placeholdersAreArray && !placeholdersAreObject) {
        fail(`resources[${index}].url.placeholders must be an array or object when present.`);
      }
      if (placeholdersAreObject) {
        for (const [name, spec] of Object.entries(placeholders)) {
          if (!isPlainObject(spec)) {
            fail(`resources[${index}].url.placeholders.${name} must be an object.`);
            continue;
          }
          if ('pipeline' in spec && !Array.isArray(spec.pipeline)) {
            fail(`resources[${index}].url.placeholders.${name}.pipeline must be an array when present.`);
          }
        }
      }
    }
  }
}

const backgroundPath = path.join(root, 'background.js');
const backgroundJs = fs.readFileSync(backgroundPath, 'utf8');
if (!backgroundJs.includes('chrome.contextMenus')) {
  fail('background.js does not appear to use chrome.contextMenus.');
}
if (!backgroundJs.includes('chrome.storage')) {
  fail('background.js does not appear to use chrome.storage.');
}

if (hadError) {
  process.exit(1);
}

console.log('Extension validation passed.');
