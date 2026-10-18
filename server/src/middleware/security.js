/* =========================================================
   Cabeceras de seguridad, CORS restringido y HTTPS.
   ========================================================= */
import crypto from 'node:crypto';
import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // Sin scripts en línea: todo el JS vive en /js (CSP estricta)
      scriptSrc: ["'self'"],
      // Los estilos en línea son variables CSS en atributos style (--delay, --g…)
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com', 'https://res.cloudinary.com'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      // En local (http) no forzamos la actualización a https
      upgradeInsecureRequests: env.isProd ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: env.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/** Permissions-Policy: la web no necesita cámara, micro ni geolocalización. */
export function permissionsPolicy(_req, res, next) {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  next();
}

const allowedOrigins = new Set([env.APP_URL, ...env.CORS_ORIGINS]);

export const apiCors = cors({
  // Peticiones sin Origin (mismo origen, curl, health checks) pasan; el resto solo si está en la lista
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 600
});

/** Detrás de un proxy (Render, Railway…) redirige http → https. Requiere TRUST_PROXY. */
export function enforceHttps(req, res, next) {
  // Vercel ya fuerza HTTPS en su borde: redirigir aquí solo puede crear bucles
  if (!env.isProd || process.env.VERCEL || req.secure || req.get('x-forwarded-proto') === 'https' || req.path === '/api/health') return next();
  res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
}

/** Identificador por petición para correlacionar logs y respuestas de error. */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
