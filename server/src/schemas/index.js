/* =========================================================
   Esquemas de entrada de la API (Zod).
   .strict() en los cuerpos: cualquier campo desconocido → 400.
   ========================================================= */
import { z } from 'zod';
import { LIMITS, CATEGORIES } from '../../../public/shared/constraints.js';
import { sanitizeText } from '../lib/sanitize.js';
import {
  nameSchema, emailSchema, phoneSchema, slugSchema, freeText, honeypot,
  startDateSchema, travelersSchema, paginationSchema
} from './common.js';

const boolString = z.enum(['true', 'false']).transform(v => v === 'true');

/* ---------- Destinos y paquetes ---------- */
export const listDestinationsQuery = z.object({
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: `Categoría no válida. Usa: ${CATEGORIES.join(', ')}.` }) }).optional(),
  featured: boolString.optional(),
  search: z.string().trim().max(LIMITS.search.max).optional(),
  maxDays: z.coerce.number().int().min(2).max(60).optional(),
  sort: z.enum(['featured', 'price_asc', 'price_desc', 'rating']).default('featured'),
  ...paginationSchema
});

export const idOrSlugParams = z.object({
  idOrSlug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i, 'Identificador no válido.')
});

export const listPackagesQuery = z.object({
  destination: slugSchema.optional()
});

export const slugParams = z.object({ slug: slugSchema });

export const availabilityQuery = z.object({
  startDate: startDateSchema
});

/* ---------- Cotizador ---------- */
export const quoteBody = z.object({
  budgetPerNight: z.number({ required_error: 'Falta el presupuesto por noche.' })
    .min(LIMITS.budget.min, `El presupuesto mínimo es de $${LIMITS.budget.min} por noche.`)
    .max(LIMITS.budget.max, `El presupuesto máximo es de $${LIMITS.budget.max} por noche.`),
  nights: z.number({ required_error: 'Falta la duración.' }).int()
    .min(LIMITS.nights.min, `Mínimo ${LIMITS.nights.min} noches.`)
    .max(LIMITS.nights.max, `Máximo ${LIMITS.nights.max} noches.`),
  travelers: travelersSchema,
  includeFlights: z.boolean().default(true),
  destinationSlug: slugSchema.optional()
}).strict();

/* ---------- Reservas ---------- */
export const bookingBody = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  packageSlug: slugSchema,
  startDate: startDateSchema,
  travelers: travelersSchema,
  notes: freeText(LIMITS.notes.max, `Las notas no pueden superar ${LIMITS.notes.max} caracteres.`),
  payDeposit: z.boolean().default(false),
  website: honeypot
}).strict();

/* ---------- Newsletter ---------- */
export const subscribeBody = z.object({
  email: emailSchema,
  source: z.enum(['footer', 'checkout']).default('footer'),
  website: honeypot
}).strict();

export const unsubscribeQuery = z.object({
  token: z.string().uuid('Enlace de baja no válido.')
});

/* ---------- Reseñas ---------- */
export const listReviewsQuery = z.object({
  destination: slugSchema.optional(),
  ...paginationSchema
});

export const reviewBody = z.object({
  authorName: nameSchema,
  authorLocation: freeText(LIMITS.location.max, 'La ciudad es demasiado larga.'),
  rating: z.number({ required_error: 'Elige una valoración.' }).int()
    .min(LIMITS.rating.min, 'Elige de 1 a 5 estrellas.')
    .max(LIMITS.rating.max, 'Elige de 1 a 5 estrellas.'),
  comment: z.string({ required_error: 'Cuéntanos tu experiencia.' }).trim()
    .min(LIMITS.comment.min, `Cuéntanos un poco más (mínimo ${LIMITS.comment.min} caracteres).`)
    .max(LIMITS.comment.max, `Máximo ${LIMITS.comment.max} caracteres.`)
    .transform(sanitizeText)
    .refine(v => v.length >= LIMITS.comment.min, `Cuéntanos un poco más (mínimo ${LIMITS.comment.min} caracteres).`),
  destinationSlug: slugSchema.optional(),
  website: honeypot
}).strict();

/* ---------- Administración ---------- */
export const uuidParams = z.object({ id: z.string().uuid('Identificador no válido.') });

export const bookingStatusBody = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled'])
}).strict();

export const reviewStatusBody = z.object({
  status: z.enum(['approved', 'rejected'])
}).strict();

export const uploadSignatureBody = z.object({
  folder: z.enum(['destinations', 'avatars']).default('destinations')
}).strict();
