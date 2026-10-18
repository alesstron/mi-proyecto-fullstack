/* =========================================================
   Renderizado del documento con SEO dinámico.
   - Sustituye el bloque <!--seo:start-->…<!--seo:end--> de
     index.html por title/description/canonical/OG/Twitter y
     JSON-LD (TravelAgency + TouristTrip) generados desde la BD.
   - Incrusta los datos iniciales como JSON para que el front
     pinte sin esperar a la API (hidratación sin cascada).
   - Si la base de datos falla, sirve la plantilla estática y
     el front se recupera solo.
   ========================================================= */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { log } from '../lib/logger.js';
import { escapeHtml as e, safeJson } from '../lib/sanitize.js';
import { ogImage } from '../lib/images.js';
import { paymentsEnabled } from '../lib/payments.js';
import { prisma } from '../lib/prisma.js';
import { listDestinations, listPackages } from '../services/catalog.service.js';
import { listReviews } from '../services/community.service.js';
import { PRICING } from '../../../public/shared/pricing.js';

export const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../public');

const SEO_BLOCK = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;
const DATA_SLOT = '<!--data:bootstrap-->';
const DEFAULT_TITLE = 'Rumbo Nómada | Viajes auténticos con guías locales';
const DEFAULT_DESC = 'Agencia de viajes con guías locales, rutas a medida y precio cerrado. Cancún, Machu Picchu, Santorini, Tokio, Patagonia y Bali.';

let templateCache = null;
async function getTemplate() {
  if (templateCache && env.isProd) return templateCache;
  templateCache = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  return templateCache;
}

/* ---------- JSON-LD ---------- */
const agencyId = () => `${env.APP_URL}/#agency`;

function travelAgency(image) {
  return {
    '@type': 'TravelAgency',
    '@id': agencyId(),
    name: 'Rumbo Nómada',
    url: env.APP_URL + '/',
    logo: `${env.APP_URL}/icons/icon-512.png`,
    image,
    description: DEFAULT_DESC,
    email: 'hola@rumbonomada.com',
    telephone: '+52 55 1234 5678',
    priceRange: '$$',
    address: { '@type': 'PostalAddress', addressLocality: 'Ciudad de México', addressCountry: 'MX' },
    areaServed: ['MX', 'ES', 'CO', 'AR', 'CL', 'PE'],
    knowsLanguage: ['es', 'en']
  };
}

function touristTrip(pkg, destination) {
  const url = `${env.APP_URL}/destinos/${destination.slug}`;
  return {
    '@type': 'TouristTrip',
    name: pkg.title,
    description: `${pkg.route}. ${pkg.days} días con guía local en ${destination.title}.`,
    url,
    image: destination.images?.[0] ? ogImage(destination.images[0]) : undefined,
    touristType: 'Viajeros que buscan experiencias auténticas',
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: pkg.itinerary.length,
      itemListElement: pkg.itinerary.map((d, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'Place', name: d.title, description: d.description }
      }))
    },
    offers: {
      '@type': 'Offer',
      price: pkg.pricePerPerson,
      priceCurrency: PRICING.currency,
      availability: 'https://schema.org/InStock',
      url
    },
    provider: { '@id': agencyId() }
  };
}

function headTags({ title, description, canonical, image, robots = 'index,follow', graph }) {
  const ld = { '@context': 'https://schema.org', '@graph': graph };
  return `<!--seo:start-->
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(canonical)}">
<meta name="robots" content="${robots}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rumbo Nómada">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(canonical)}">
<meta property="og:image" content="${e(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(image)}">
<script type="application/ld+json">${safeJson(ld)}</script>
<!--seo:end-->`;
}

/* ---------- Página ---------- */
const money = n => '$' + Math.round(n).toLocaleString('es-MX');

async function loadBootstrap() {
  const [destinations, packages, reviews] = await Promise.all([
    listDestinations({ sort: 'featured', page: 1, limit: 24 }),
    listPackages({}),
    listReviews({ page: 1, limit: 8 })
  ]);
  return {
    destinations: destinations.data,
    packages,
    reviews: reviews.data,
    reviewSummary: reviews.summary,
    config: { payments: paymentsEnabled(), currency: PRICING.currency, depositRate: PRICING.depositRate, taxRate: PRICING.taxRate }
  };
}

/**
 * @param {{ slug?: string, notFound?: boolean }} opts
 */
export async function renderPage(req, res, { slug, notFound = false } = {}) {
  // <base> solo bajo Express: así /destinos/:slug resuelve css/ y js/ desde la raíz,
  // y el archivo abierto como estático conserva sus rutas relativas
  const html = (await getTemplate()).replace('<!--base-->', '<base href="/">');
  let status = notFound ? 404 : 200;
  let out = html;

  try {
    const data = await loadBootstrap();
    const homeImage = ogImage(data.destinations.find(d => d.slug === 'santorini')?.images[0] ?? data.destinations[0]?.images[0]);
    let meta;

    if (slug) {
      const dest = data.destinations.find(d => d.slug === slug);
      const pkg = dest && data.packages.find(p => p.destination.slug === slug);
      if (!dest || !pkg) {
        status = 404;
        data.notFound = slug;
      } else {
        data.openPackage = pkg.slug;
        const image = ogImage(dest.images[0]) ?? homeImage;
        const canonical = `${env.APP_URL}/destinos/${dest.slug}`;
        meta = {
          title: `${dest.title}: ${pkg.title}, ${pkg.days} días desde ${money(pkg.pricePerPerson)} | Rumbo Nómada`,
          description: `${dest.description} ${pkg.route}, grupos de máximo ${pkg.maxGroupSize}.`.slice(0, 300),
          canonical,
          image,
          graph: [
            travelAgency(homeImage),
            touristTrip(pkg, dest),
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: env.APP_URL + '/' },
                { '@type': 'ListItem', position: 2, name: 'Destinos', item: `${env.APP_URL}/#destinos` },
                { '@type': 'ListItem', position: 3, name: dest.title, item: canonical }
              ]
            }
          ]
        };
      }
    }

    if (!meta) {
      const trips = data.packages.map(p => touristTrip(p, data.destinations.find(d => d.slug === p.destination.slug) ?? p.destination));
      meta = {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
        canonical: env.APP_URL + '/',
        image: homeImage,
        robots: status === 404 ? 'noindex,follow' : 'index,follow',
        graph: [travelAgency(homeImage), ...trips]
      };
    }

    out = out
      .replace(SEO_BLOCK, headTags(meta))
      .replace(DATA_SLOT, `<script type="application/json" id="bootstrap-data">${safeJson(data)}</script>`);
  } catch (err) {
    log.warn('SSR sin datos: se sirve la plantilla estática', { err: err.message });
  }

  res
    .status(status)
    .set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
    .type('html')
    .send(out);
}

/* ---------- sitemap.xml y robots.txt ---------- */
export async function sitemap(_req, res) {
  const destinations = await prisma.destination.findMany({ select: { slug: true, updatedAt: true }, orderBy: { title: 'asc' } });
  const urls = [
    `<url><loc>${e(env.APP_URL)}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...destinations.map(d =>
      `<url><loc>${e(env.APP_URL)}/destinos/${e(d.slug)}</loc><lastmod>${d.updatedAt.toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`)
  ];
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}

export function robots(_req, res) {
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400')
    .send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${env.APP_URL}/sitemap.xml\n`);
}
