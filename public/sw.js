/* =========================================================
   Service Worker de Rumbo Nómada.
   - Precarga el "app shell" para abrir la web sin conexión.
   - Documento y estáticos: network-first (siempre la versión
     nueva si hay red; la copia en caché si no la hay).
   - GET de la API de catálogo: network-first con respaldo.
   - Nunca cachea POST ni datos personales.
   Sube VERSION al cambiar la lista de archivos precargados.
   ========================================================= */
const VERSION = 'rn-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL = [
  '/', '/offline.html', '/manifest.webmanifest', '/css/styles.css',
  '/js/theme-init.js', '/js/main.js', '/js/pwa.js',
  '/js/core/dom.js', '/js/core/api.js', '/js/core/store.js',
  '/js/ui/toast.js', '/js/ui/chrome.js', '/js/ui/hero.js', '/js/ui/route.js', '/js/ui/bento.js',
  '/js/ui/drawer.js', '/js/ui/destinations.js', '/js/ui/carousel.js', '/js/ui/quote.js',
  '/js/ui/testimonials.js', '/js/ui/forms.js', '/js/ui/booking.js', '/js/ui/newsletter.js',
  '/shared/constraints.js', '/shared/pricing.js', '/shared/catalog.js',
  '/icons/icon.svg', '/icons/icon-192.png'
];
const CACHEABLE_API = /^\/api\/(destinations|packages|reviews|config)(\/|$|\?)/;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch {
    const cached = (await cache.match(request)) ?? (await caches.match(request, { ignoreSearch: request.mode === 'navigate' }));
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    return new Response(JSON.stringify({ error: { code: 'OFFLINE', message: 'Sin conexión.' } }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, '/offline.html'));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API.test(url.pathname + url.search)) event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }
  event.respondWith(networkFirst(request, SHELL_CACHE));
});
