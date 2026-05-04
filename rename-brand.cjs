#!/usr/bin/env node
// One-shot rename helper: CorpMind → Orlode, CORPMIND → ORLODE
// Safe scope: only source files, skips node_modules/dist/.cache/lock files.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.cache', '.git', '.next', 'build', '.firebase']);
const SKIP_FILES = new Set(['package-lock.json', 'yarn.lock', '.package-lock.json', 'rename-brand.cjs', '.env.cloud', '.env.cloud.yaml']);
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css', '.yaml', '.yml']);

const REPLACEMENTS = [
  [/CorpMind/g, 'Orlode'],
  [/CORPMIND/g, 'ORLODE'],
];

let filesChanged = 0;
let replacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (SKIP_FILES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) continue;

    let content;
    try { content = fs.readFileSync(full, 'utf8'); }
    catch { continue; }
    let changed = content;
    let count = 0;
    for (const [regex, replace] of REPLACEMENTS) {
      const matches = changed.match(regex);
      if (matches) {
        count += matches.length;
        changed = changed.replace(regex, replace);
      }
    }
    if (count > 0 && changed !== content) {
      fs.writeFileSync(full, changed);
      filesChanged++;
      replacements += count;
      console.log(`  ${path.relative(ROOT, full)} (${count})`);
    }
  }
}

console.log('Renaming CorpMind → Orlode, CORPMIND → ORLODE...');
walk(ROOT);
console.log(`\nDone: ${replacements} replacements across ${filesChanged} files.`);
