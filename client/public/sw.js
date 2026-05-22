/**
 * Orlode AI — Service Worker
 * - Network-first for hashed Vite chunks (so new deploys always load fresh JS)
 * - Cache fallback only if network fails (offline mode)
 */
const CACHE_NAME = 'orlode-v4';
// Don't pre-cache '/' — otherwise an old index.html gets stuck and navigation is broken.
const STATIC_ASSETS = [
  '/logo.png',
  '/manifest.json',
];

// Install — pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls — network only (no cache)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) {
    return;
  }

  // Hashed JS/CSS chunks (Vite /assets/*) — network-first so new deploys aren't stuck on old chunks
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  // Images and fonts — cache-first is fine (rarely changes, huge bandwidth saver)
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation — network only. Never fall back to a cached HTML,
  // otherwise a stale routing gets stuck on `/` and redirects users incorrectly.
  if (request.mode === 'navigate') {
    return; // let the browser fetch fresh from the network
  }
});
