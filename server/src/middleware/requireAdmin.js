import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { unauthorized } from '../lib/errors.js';

const digest = s => crypto.createHash('sha256').update(s).digest();

/** Authorization: Bearer <ADMIN_API_KEY>. Comparación en tiempo constante. */
export function requireAdmin(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!env.ADMIN_API_KEY || !token || !crypto.timingSafeEqual(digest(token), digest(env.ADMIN_API_KEY))) {
    return next(unauthorized('Necesitas una clave de administración válida.'));
  }
  next();
}
