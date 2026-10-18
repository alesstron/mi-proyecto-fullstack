/* =========================================================
   Datos iniciales con tres niveles de respaldo:
   1. JSON incrustado por el servidor (SSR) → pinta sin esperas.
   2. API REST → si la página se sirvió estática.
   3. Catálogo local → si no hay backend (modo demostración).
   ========================================================= */
import { api } from './api.js';
import { normalize } from './dom.js';

export const store = {
  destinations: [],
  packages: [],
  reviews: [],
  reviewSummary: null,
  config: { payments: false, currency: 'USD', depositRate: 0.2, taxRate: 0.16 },
  source: 'api',
  openPackage: null,
  notFound: null
};

export async function loadInitialData() {
  const embedded = document.getElementById('bootstrap-data');
  if (embedded) {
    try {
      Object.assign(store, JSON.parse(embedded.textContent), { source: 'ssr' });
      return store;
    } catch { /* JSON corrupto: seguimos con la API */ }
  }

  try {
    const [d, p, r, c] = await Promise.all([
      api('/api/destinations', { query: { limit: 24 } }),
      api('/api/packages'),
      api('/api/reviews', { query: { limit: 8 } }),
      api('/api/config')
    ]);
    Object.assign(store, { destinations: d.data, packages: p.data, reviews: r.data, reviewSummary: r.summary, config: c.data, source: 'api' });
  } catch {
    const catalog = await import('../../shared/catalog.js');
    Object.assign(store, fromCatalog(catalog), { source: 'fallback' });
  }

  // Deep link en sitio estático: /destinos/:slug abre el paquete
  const m = location.pathname.match(/^\/destinos\/([a-z0-9-]+)\/?$/);
  if (m && !store.openPackage) store.openPackage = packageForDestination(m[1])?.slug ?? null;
  return store;
}

export const destinationBySlug = slug => store.destinations.find(d => d.slug === slug);
export const packageBySlug = slug => store.packages.find(p => p.slug === slug);
export const packageForDestination = slug => store.packages.find(p => p.destination.slug === slug);

/** Búsqueda local equivalente a la del servidor (sin acentos). */
export function searchLocal(term, maxDays) {
  const q = normalize(term);
  return store.destinations.filter(d =>
    [d.title, d.country, d.location, d.slug].some(v => normalize(v).includes(q)) &&
    (!maxDays || d.packages.some(p => p.days <= maxDays)));
}

/* ---------- Adaptador del catálogo local al formato de la API ---------- */
function unsplash(url, w) {
  return `${url}?auto=format&fit=crop&w=${w}&q=70`;
}

function fromCatalog({ DESTINATIONS, PACKAGES, REVIEWS }) {
  const pkgOut = PACKAGES.map(p => {
    const d = DESTINATIONS.find(x => x.slug === p.destination);
    return {
      slug: p.slug, title: p.title, route: p.route, days: p.days, nights: p.days - 1,
      pricePerPerson: p.pricePerPerson, itinerary: p.itinerary, includes: p.includes,
      maxGroupSize: p.maxGroupSize, emoji: p.emoji,
      destination: { slug: d.slug, title: d.title, country: d.country, gradient: d.gradient, emoji: d.emoji }
    };
  });
  const destinations = DESTINATIONS.map(d => {
    const pk = pkgOut.filter(p => p.destination.slug === d.slug);
    return {
      ...d,
      categories: [d.category, ...d.tags],
      cover: d.images[0] ? { src: unsplash(d.images[0], 800), srcset: [480, 800, 1200].map(w => `${unsplash(d.images[0], w)} ${w}w`).join(', ') } : null,
      fromPrice: pk[0]?.pricePerPerson ?? null,
      days: pk[0]?.days ?? null,
      packages: pk
    };
  });
  const reviews = REVIEWS.map((r, i) => {
    const d = DESTINATIONS.find(x => x.slug === r.destination);
    return { id: `local-${i}`, ...r, avatarUrl: null, destination: d ? { slug: d.slug, title: d.title } : null };
  });
  return { destinations, packages: pkgOut, reviews, reviewSummary: null };
}
