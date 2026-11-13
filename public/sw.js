// Nuvia Service Worker
//
// - App files that never change (/_next/static/* are content-hashed, plus
//   icons and images): served from cache first, so a relaunch doesn't wait on
//   the network.
// - Pages: network first, but fall back to the cached page after a few seconds
//   on a slow connection (and when offline).
// - API calls and other sites (Supabase, Gemini) are never cached here: the
//   app keeps its own data cache, and responses can hold private data.
const CACHE_NAME = 'nuvia-pwa-v11';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/onboarding-bg.webp',
];
const PAGE_TIMEOUT_MS = 3500;
// In development the files under /_next/static change in place; never cache them there.
const IS_DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // One missing file must not break the install.
      Promise.all(ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

const isImmutable = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  /\.(?:png|jpe?g|webp|svg|ico|woff2?)$/.test(url.pathname);

function put(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return put(request, await fetch(request));
}

async function pageNetworkFirst(request) {
  const network = fetch(request).then((response) => put(request, response));
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), PAGE_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
  } catch {
    /* offline: use the cache below */
  }
  const cached = (await caches.match(request)) || (await caches.match('/'));
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (IS_DEV || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  }
  // Everything else goes straight to the network.
});
