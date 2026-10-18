/* =========================================================
   Router de la API REST (/api)
   ========================================================= */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  quoteLimiter, bookingLimiter, newsletterLimiter, reviewLimiter, adminLimiter
} from '../middleware/rateLimits.js';
import * as s from '../schemas/index.js';
import * as catalog from '../controllers/catalog.controller.js';
import * as booking from '../controllers/booking.controller.js';
import * as community from '../controllers/community.controller.js';
import { prisma } from '../lib/prisma.js';
import { paymentsEnabled } from '../lib/payments.js';
import { PRICING } from '../../../public/shared/pricing.js';
import { seedCatalog } from '../services/seed.service.js';

export const api = Router();

/* ---------- Salud y configuración pública ---------- */
api.get('/health', async (_req, res) => {
  let db = 'up';
  try { await prisma.$queryRaw`SELECT 1`; } catch { db = 'down'; }
  res.set('Cache-Control', 'no-store')
    .status(db === 'up' ? 200 : 503)
    .json({ status: db === 'up' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) });
});

api.get('/config', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ data: { payments: paymentsEnabled(), currency: PRICING.currency, depositRate: PRICING.depositRate, taxRate: PRICING.taxRate } });
});

/* ---------- Carga inicial de datos ----------
   Sin destinos en la BD cualquiera puede lanzarla (primer arranque en Vercel).
   Con datos, exige Authorization: Bearer ADMIN_API_KEY para no reescribir el catálogo. */
api.get('/seed', adminLimiter, async (req, res, next) => {
  try {
    if ((await prisma.destination.count()) > 0) {
      return requireAdmin(req, res, async err => {
        if (err) return next(err);
        res.set('Cache-Control', 'no-store').json({ data: await seedCatalog(prisma), reseeded: true });
      });
    }
    res.set('Cache-Control', 'no-store').json({ data: await seedCatalog(prisma), reseeded: false });
  } catch (e) { next(e); }
});

/* ---------- Destinos y paquetes ---------- */
api.get('/destinations', validate({ query: s.listDestinationsQuery }), catalog.listDestinations);
api.get('/destinations/:idOrSlug', validate({ params: s.idOrSlugParams }), catalog.getDestination);
api.get('/packages', validate({ query: s.listPackagesQuery }), catalog.listPackages);
api.get('/packages/:slug/availability', validate({ params: s.slugParams, query: s.availabilityQuery }), catalog.getAvailability);

/* ---------- Cotización y reservas ---------- */
api.post('/quotes/calculate', quoteLimiter, validate({ body: s.quoteBody }), booking.quote);
api.post('/bookings', bookingLimiter, validate({ body: s.bookingBody }), booking.createBooking);

/* ---------- Newsletter ---------- */
api.post('/newsletter/subscribe', newsletterLimiter, validate({ body: s.subscribeBody }), community.subscribe);
api.get('/newsletter/unsubscribe', validate({ query: s.unsubscribeQuery }), community.unsubscribe);

/* ---------- Reseñas ---------- */
api.get('/reviews', validate({ query: s.listReviewsQuery }), community.listReviews);
api.post('/reviews', reviewLimiter, validate({ body: s.reviewBody }), community.createReview);

/* ---------- Administración (Bearer ADMIN_API_KEY) ---------- */
const admin = Router();
admin.use(adminLimiter, requireAdmin);
admin.patch('/bookings/:id/status', validate({ params: s.uuidParams, body: s.bookingStatusBody }), booking.updateBookingStatus);
admin.patch('/reviews/:id', validate({ params: s.uuidParams, body: s.reviewStatusBody }), community.moderateReview);
admin.post('/uploads/signature', validate({ body: s.uploadSignatureBody }), community.uploadSignature);
api.use('/admin', admin);
