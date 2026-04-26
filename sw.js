// The Bar - Service Worker
const VERSION = 'v1';
const CACHE_SHELL = `bar-shell-${VERSION}`;
const CACHE_DATA = `bar-data-${VERSION}`;
const CACHE_RUNTIME = `bar-runtime-${VERSION}`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './app.jsx',
  './style.css',
  './manifest.webmanifest',
  './substitutions.json',
  './custom-cocktails.json',
  './icons/apple-touch-icon.png',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

const DATA_PATHS = ['/cocktails.json', '/custom-cocktails.json', '/substitutions.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW] failed to cache', url, err.message)
          )
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![CACHE_SHELL, CACHE_DATA, CACHE_RUNTIME].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (DATA_PATHS.some((p) => url.pathname.endsWith(p))) {
    event.respondWith(staleWhileRevalidate(req, CACHE_DATA));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(cacheFirst(req, CACHE_RUNTIME));
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((resp) => {
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}
