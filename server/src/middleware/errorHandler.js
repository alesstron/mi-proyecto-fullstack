/* =========================================================
   Manejo centralizado de errores.
   Formato único: { error: { code, message, details?, requestId } }
   Nunca se filtran trazas ni mensajes internos al cliente.
   ========================================================= */
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { log } from '../lib/logger.js';

export function apiNotFound(req, _res, next) {
  next(notFound(`No existe el endpoint ${req.method} ${req.baseUrl}${req.path}`));
}

function normalize(err) {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Hay datos que revisar.',
      err.issues.map(i => ({ field: i.path.join('.') || null, message: i.message })));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return new AppError(409, 'CONFLICT', 'Ese registro ya existe.');
    if (err.code === 'P2025') return new AppError(404, 'NOT_FOUND', 'Recurso no encontrado.');
    if (err.code === 'P2034') return new AppError(409, 'CONFLICT', 'Hubo mucha demanda a la vez. Vuelve a intentarlo.');
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new AppError(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible en este momento.');
  }

  // Errores de body-parser
  if (err.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'El cuerpo de la petición no es JSON válido.');
  if (err.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande.');
  if (err.type === 'encoding.unsupported' || err.status === 415) return new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Formato no soportado.');

  return new AppError(500, 'INTERNAL_ERROR', 'Algo salió mal de nuestro lado. Inténtalo de nuevo en unos minutos.');
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const e = normalize(err);

  if (e.status >= 500 && err instanceof AppError) {
    log.warn(e.message, { requestId: req.id, path: req.originalUrl });
  } else if (e.status >= 500) {
    log.error('Error no controlado', { requestId: req.id, method: req.method, path: req.originalUrl, err: err.message, stack: err.stack });
  }
  if (res.headersSent) return;

  res.status(e.status).json({
    error: {
      code: e.code,
      message: e.message,
      ...(e.details !== undefined && { details: e.details }),
      requestId: req.id
    }
  });
}
