/* =========================================================
   Rate limiting por IP. Cada limitador tiene su propio contador.
   Las respuestas 429 pasan por el manejador central de errores.
   En producción con varias instancias, usa un store compartido
   (p. ej. rate-limit-redis) en lugar del de memoria.
   ========================================================= */
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message))
  });
}

// Tráfico general de la API
export const apiLimiter = limiter({
  windowMs: 15 * 60_000, limit: 300,
  message: 'Demasiadas peticiones seguidas. Espera unos minutos y vuelve a intentarlo.'
});

// El cotizador se llama mientras el usuario mueve los sliders (con debounce en el front)
export const quoteLimiter = limiter({
  windowMs: 60_000, limit: 60,
  message: 'Vas muy rápido con el cotizador. Espera un momento.'
});

// Formularios: frenan spam y fuerza bruta
export const bookingLimiter = limiter({
  windowMs: 60 * 60_000, limit: 8,
  message: 'Has enviado varias solicitudes en poco tiempo. Escríbenos a hola@rumbonomada.com si necesitas ayuda.'
});
export const newsletterLimiter = limiter({
  windowMs: 60 * 60_000, limit: 5,
  message: 'Demasiados intentos de suscripción. Prueba de nuevo más tarde.'
});
export const reviewLimiter = limiter({
  windowMs: 60 * 60_000, limit: 3,
  message: 'Ya recibimos tus opiniones. ¡Gracias! Prueba de nuevo más tarde.'
});

// Protege la clave de administración contra fuerza bruta
export const adminLimiter = limiter({
  windowMs: 15 * 60_000, limit: 30,
  message: 'Demasiados intentos. Espera 15 minutos.'
});
