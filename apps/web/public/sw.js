/*
 * ServiceWorker — Terrasses de Baguida
 *
 * Strategies:
 *   - precache: shell minimal + offline fallback
 *   - navigation (HTML)    : network-first, fallback offline page
 *   - assets statiques _next/static, js, css, images) : stale-while-revalidate
 *   - polices Google Fonts : cache-first, expire 30j (stale-while-revalidate)
 *   - API backend (JSON)   : network-first, court timeout
 *
 * Versionning: bump CACHE_VERSION pour forcer la migration.
 */

const CACHE_VERSION = 'v2';
const PRECACHE = `terrasses-precache-${CACHE_VERSION}`;
const RUNTIME_HTML = `terrasses-html-${CACHE_VERSION}`;
const RUNTIME_ASSET = `terrasses-asset-${CACHE_VERSION}`;
const RUNTIME_FONT = `terrasses-font-${CACHE_VERSION}`;
const RUNTIME_API = `terrasses-api-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.svg',
];

const OFFLINE_URL = '/offline';

// Limites pour eviter une croissance infinie du cache runtime
const MAX_RUNTIME_ENTRIES = 60;
const FONT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] precache echoue', err)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) =>
              ![PRECACHE, RUNTIME_HTML, RUNTIME_ASSET, RUNTIME_FONT, RUNTIME_API].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// L'utilisateur (ou le client SW) peut forcer l'activation immediate
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHTMLRequest(req) {
  return (
    req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'))
  );
}

function isStaticAssetRequest(req) {
  const url = new URL(req.url);
  if (req.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot)$/.test(url.pathname)
  );
}

function isFontRequest(req) {
  const url = new URL(req.url);
  return (
    req.method === 'GET' &&
    (url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com')
  );
}

function isApiRequest(req) {
  const url = new URL(req.url);
  return req.method === 'GET' && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/catalog/'));
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // FIFO : supprime les plus anciens
  for (let i = 0; i < keys.length - maxEntries; i++) {
    await cache.delete(keys[i]);
  }
}

// Strategy: network-first avec fallback offline
async function handleNavigation(req) {
  const cache = await caches.open(RUNTIME_HTML);
  try {
    const networkResponse = await fetch(req);
    if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
      cache.put(req, networkResponse.clone());
    }
    return networkResponse;
  } catch (_err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ||
      new Response("Vous etes hors-ligne et la page n'est pas en cache.", {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

// Strategy: stale-while-revalidate
async function handleStaticAsset(req) {
  const cache = await caches.open(RUNTIME_ASSET);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(req, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || network || Response.error();
}

// Strategy: cache-first avec TTL 30j + revalidate en arriere-plan
async function handleFont(req) {
  const cache = await caches.open(RUNTIME_FONT);
  const cached = await cache.match(req);

  if (cached) {
    const dateHeader = cached.headers.get('date');
    const ageMs = dateHeader ? Date.now() - new Date(dateHeader).getTime() : 0;
    if (ageMs < FONT_TTL_MS) {
      return cached;
    }
  }

  try {
    const networkResponse = await fetch(req);
    if (networkResponse && networkResponse.ok) {
      cache.put(req, networkResponse.clone());
    }
    return networkResponse || cached || Response.error();
  } catch (_err) {
    return cached || Response.error();
  }
}

// Strategy: network-first, court timeout (3s), fallback cache
async function handleApi(req) {
  const cache = await caches.open(RUNTIME_API);
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('api-timeout')), 3000),
  );

  try {
    const networkResponse = await Promise.race([fetch(req), timeout]);
    if (networkResponse && networkResponse.ok) {
      cache.put(req, networkResponse.clone());
    }
    return networkResponse;
  } catch (_err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: "Donnees indisponibles hors-ligne." }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignorer les requetes non GET (POST reservation, paiement, etc.)
  if (req.method !== 'GET') return;

  let handler;
  if (isHTMLRequest(req)) {
    handler = handleNavigation(req);
  } else if (isFontRequest(req)) {
    handler = handleFont(req);
  } else if (isStaticAssetRequest(req)) {
    handler = handleStaticAsset(req);
  } else if (isApiRequest(req)) {
    handler = handleApi(req);
  } else {
    return; // Laisser le navigateur gerer (par défaut)
  }

  event.respondWith(handler);

  // Nettoyage non-bloquant apres reponse
  event.waitUntil(
    Promise.all([
      trimCache(RUNTIME_HTML, MAX_RUNTIME_ENTRIES),
      trimCache(RUNTIME_ASSET, MAX_RUNTIME_ENTRIES),
      trimCache(RUNTIME_API, MAX_RUNTIME_ENTRIES),
    ]),
  );
});
