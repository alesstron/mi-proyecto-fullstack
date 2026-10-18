import * as catalog from '../services/catalog.service.js';

// Respuestas públicas y cacheables por CDN; stale-while-revalidate evita esperas
const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export async function listDestinations(req, res) {
  res.set('Cache-Control', PUBLIC_CACHE);
  res.json(await catalog.listDestinations(req.valid.query));
}

export async function getDestination(req, res) {
  res.set('Cache-Control', PUBLIC_CACHE);
  res.json({ data: await catalog.getDestination(req.valid.params.idOrSlug) });
}

export async function listPackages(req, res) {
  res.set('Cache-Control', PUBLIC_CACHE);
  res.json({ data: await catalog.listPackages(req.valid.query) });
}

export async function getAvailability(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ data: await catalog.getAvailability(req.valid.params.slug, req.valid.query.startDate) });
}
