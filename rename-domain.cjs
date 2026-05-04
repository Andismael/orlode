#!/usr/bin/env node
// Replace all hard-coded firebase URLs with the production custom domain.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OLD = 'https://mon-assistant-86bbd.web.app';
const NEW = 'https://orlode.com';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.cache', '.git', '.firebase']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', 'rename-domain.cjs', '.env.cloud', '.env.cloud.yaml']);
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.yaml', '.yml']);

let files = 0, repls = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full); continue; }
    if (SKIP_FILES.has(e.name)) continue;
    if (!ALLOWED_EXT.has(path.extname(e.name).toLowerCase())) continue;
    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
    if (!content.includes(OLD)) continue;
    const matches = content.match(new RegExp(OLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    const next = content.split(OLD).join(NEW);
    if (next !== content) {
      fs.writeFileSync(full, next);
      files++; repls += matches ? matches.length : 0;
      console.log(`  ${path.relative(ROOT, full)} (${matches ? matches.length : 0})`);
    }
  }
}
console.log(`Replacing ${OLD} → ${NEW} ...`);
walk(ROOT);
console.log(`\nDone: ${repls} replacements across ${files} files.`);
