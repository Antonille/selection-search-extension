#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const scanHistory = !args.has('--no-history');

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'release']);
const sensitiveFilenames = [
  '.env', '.env.local', '.env.production', '.env.development',
  'credentials.json', 'secrets.json', 'id_rsa', 'id_dsa', '.npmrc'
];

const patterns = [
  { name: 'GitHub fine-grained token', regex: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: 'OpenAI-style key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Slack token', regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA|DSA|EC|OPENSSH|PGP|PRIVATE) KEY-----/g },
  { name: 'Bearer token', regex: /Bearer\s+[A-Za-z0-9._=-]{20,}/g }
];

const findings = [];

function looksBinary(buffer) {
  return buffer.includes(0);
}

function record(source, filePath, line, rule, sample) {
  findings.push({ source, filePath, line, rule, sample });
}

function scanText(source, filePath, text) {
  for (const { name, regex } of patterns) {
    for (const match of text.matchAll(regex)) {
      const index = match.index ?? 0;
      const line = text.slice(0, index).split('\n').length;
      record(source, filePath, line, name, String(match[0]).slice(0, 120));
    }
  }
}

function scanFile(source, filePath, contentBuffer) {
  const base = path.basename(filePath);
  if (sensitiveFilenames.includes(base)) {
    record(source, filePath, 1, 'Sensitive filename', base);
  }
  if (looksBinary(contentBuffer)) {
    return;
  }
  scanText(source, filePath, contentBuffer.toString('utf8'));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full) || entry.name;

    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(full);
      }
      continue;
    }

    const buf = fs.readFileSync(full);
    scanFile('working-tree', rel, buf);
  }
}

function gitAvailable() {
  return spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0;
}

function insideGitRepo() {
  if (!gitAvailable()) return false;
  try {
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' }).trim();
    return out === 'true';
  } catch {
    return false;
  }
}

function scanGitHistory() {
  const objectsRaw = execFileSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const seen = new Set();

  for (const line of objectsRaw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const space = line.indexOf(' ');
    if (space === -1) continue;
    const oid = line.slice(0, space).trim();
    const filePath = line.slice(space + 1).trim();
    if (!oid || !filePath || seen.has(oid)) continue;
    seen.add(oid);

    const base = path.basename(filePath);
    if (sensitiveFilenames.includes(base)) {
      record('git-history', filePath, 1, 'Sensitive filename in history', base);
    }

    try {
      const buf = execFileSync('git', ['cat-file', '-p', oid], { encoding: null, maxBuffer: 20 * 1024 * 1024 });
      if (looksBinary(buf)) continue;
      scanText('git-history', filePath, buf.toString('utf8'));
    } catch {
      // Ignore non-blob objects or unreadable entries.
    }
  }
}

walk(root);
if (scanHistory && insideGitRepo()) {
  scanGitHistory();
}

if (findings.length) {
  console.error('Potential secrets found:');
  for (const item of findings) {
    console.error(`- [${item.source}] ${item.filePath}:${item.line} :: ${item.rule} :: ${item.sample}`);
  }
  process.exit(1);
}

console.log(scanHistory && insideGitRepo()
  ? 'No likely secrets found in working tree or reachable git history.'
  : 'No likely secrets found in working tree.');
