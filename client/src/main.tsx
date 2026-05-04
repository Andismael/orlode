import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// ─── Stale chunk auto-recovery ────────────────────────────────────────────
// After a deploy, the cached index.html may reference chunk hashes that
// no longer exist on the server. Vite-style dynamic imports then 404 and
// the server SPA fallback returns text/html, which the browser refuses to
// execute as a module. Detect that signature, force a one-shot hard reload
// to fetch a fresh index.html, and break the loop with a sessionStorage flag.
function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  const msg = (reason instanceof Error ? reason.message : String(reason)).toLowerCase();
  return (
    msg.includes('error loading dynamically imported module') ||
    msg.includes('disallowed mime type') ||
    msg.includes('failed to fetch dynamically imported module') ||
    (msg.includes('importing') && msg.includes('failed')) ||
    msg.includes('chunkloaderror')
  );
}

function recoverFromStaleChunk(reason: unknown) {
  if (!isChunkLoadError(reason)) return false;
  const KEY = 'orlode_chunk_recovery_at';
  const last = Number(sessionStorage.getItem(KEY) ?? '0');
  // Already tried in the last 30s? Don't loop — just log and let the user reload manually.
  if (Date.now() - last < 30_000) {
    console.warn('[Stale chunk] Recovery already attempted recently — giving up to avoid reload loop.');
    return false;
  }
  sessionStorage.setItem(KEY, String(Date.now()));

  // Best-effort: drop service-worker caches before reloading so the new index.html sticks.
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => null);
  }
  console.warn('[Stale chunk] Reloading to pick up fresh index.html…');
  window.location.reload();
  return true;
}

window.addEventListener('error', (e) => {
  // Native module load errors come through here as e.error or e.message
  if (recoverFromStaleChunk(e.error ?? e.message)) e.preventDefault();
}, true);

window.addEventListener('unhandledrejection', (e) => {
  if (recoverFromStaleChunk(e.reason)) e.preventDefault();
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
