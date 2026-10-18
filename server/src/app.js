/* =========================================================
   Composición de la aplicación Express.
   El orden de los middlewares importa: seguridad primero,
   webhook con body crudo antes del parser JSON, errores al final.
   ========================================================= */
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { env } from './config/env.js';
import { log } from './lib/logger.js';
import { securityHeaders, permissionsPolicy, apiCors, enforceHttps, requestId } from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { notFound } from './lib/errors.js';
import { api } from './routes/api.js';
import { stripeWebhook } from './controllers/booking.controller.js';
import { renderPage, sitemap, robots, PUBLIC_DIR } from './seo/render.js';

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, { ms: Math.round(ms), requestId: req.id });
  });
  next();
}

function staticHeaders(res, filePath) {
  const base = path.basename(filePath);
  if (base === 'sw.js') {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Service-Worker-Allowed', '/');
  } else if (filePath.includes(`${path.sep}icons${path.sep}`)) {
    res.setHeader('Cache-Control', 'public, max-age=604800');
  } else {
    // Nombres sin hash: el navegador revalida con ETag (304) y nunca mezcla versiones
    res.setHeader('Cache-Control', 'no-cache');
  }
  if (base.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
}

export function createApp() {
  const app = express();

  // Vercel siempre va detrás de su proxy: sin esto req.secure es falso y se redirige en bucle
  app.set('trust proxy', process.env.VERCEL ? 1 : env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(enforceHttps);
  app.use(securityHeaders);
  app.use(permissionsPolicy);
  app.use(compression());

  // Stripe necesita el cuerpo sin parsear para verificar la firma
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '256kb' }), stripeWebhook);

  /* ---------- API ---------- */
  app.use('/api',
    requestLogger,
    apiCors,
    apiLimiter,
    express.json({ limit: '16kb', strict: true }),
    api,
    apiNotFound
  );

  /* ---------- SEO ---------- */
  app.get('/robots.txt', robots);
  app.get('/sitemap.xml', sitemap);

  /* ---------- Documento y estáticos ---------- */
  app.get('/', (req, res) => renderPage(req, res));
  app.get('/index.html', (_req, res) => res.redirect(301, '/'));
  app.get('/destinos/:slug', (req, res) => renderPage(req, res, { slug: req.params.slug.toLowerCase() }));
  app.use(express.static(PUBLIC_DIR, { index: false, setHeaders: staticHeaders }));

  // 404: página HTML para navegadores, JSON para el resto
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts(['html', 'json']) === 'html') return renderPage(req, res, { notFound: true });
    next(notFound());
  });

  app.use(errorHandler);
  return app;
}
