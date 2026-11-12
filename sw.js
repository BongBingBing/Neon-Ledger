// Neon Ledger service worker: cache-first, versioned. All paths relative to the SW scope
// (the game is served from a subpath, e.g. https://<user>.github.io/Neon-Ledger/).
// Bump VERSION on every release so clients pick up new files.
const VERSION = 'nl-v1';
const CACHE = 'neonledger-' + VERSION;

// Entry points: must all succeed for the install to complete.
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './src/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Every module the game imports (best effort; anything missed is cached on first fetch).
// PRECACHE-LIST-START
const MODULES = [];
// PRECACHE-LIST-END

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
    await Promise.all(MODULES.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('neonledger-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'CACHE_URLS' && Array.isArray(msg.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(msg.urls.map(async (u) => {
        try {
          const url = new URL(u, self.registration.scope);
          if (url.origin !== self.location.origin) return;
          if (await cache.match(url, { ignoreSearch: true })) return;
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await cache.put(url, res);
        } catch { /* ignore */ }
      }));
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match('./index.html');
      if (hit) return hit;
      try { return await fetch(req); } catch { return new Response('Offline', { status: 503 }); }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
