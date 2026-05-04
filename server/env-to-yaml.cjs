// Helper: convert .env.cloud -> .env.cloud.yaml for `gcloud run deploy --env-vars-file`
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '.env.cloud');
const dst = path.join(__dirname, '.env.cloud.yaml');

const content = fs.readFileSync(src, 'utf8');
const lines = content.split(/\r?\n/);
const out = [];

// Cloud Run reserves these env names — they cannot appear in --env-vars-file
const RESERVED = new Set(['PORT', 'K_SERVICE', 'K_REVISION', 'K_CONFIGURATION']);

for (const line of lines) {
  if (!line.trim() || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 0) continue;
  const key = line.slice(0, eq).trim();
  if (RESERVED.has(key)) continue;
  let val = line.slice(eq + 1);
  // Strip wrapping quotes if present
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  // YAML double-quoted scalar: escape backslash, double quote, and control chars
  const esc = val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
  out.push(`${key}: "${esc}"`);
}

fs.writeFileSync(dst, out.join('\n') + '\n');
console.log(`Wrote ${out.length} vars to ${dst}`);
