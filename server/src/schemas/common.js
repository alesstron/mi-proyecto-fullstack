import { z } from 'zod';
import { LIMITS, EMAIL_RE, PHONE_RE, SLUG_RE, ISO_DATE_RE, parseISODate, toISODate, addDays } from '../../../public/shared/constraints.js';
import { sanitizeText } from '../lib/sanitize.js';

/* Mensajes por defecto en español para los casos sin mensaje propio */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Campos no permitidos: ${issue.keys.join(', ')}.` };
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === 'undefined' ? 'Este campo es obligatorio.' : 'Tipo de dato no válido.' };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Valor no válido. Opciones: ${issue.options.join(', ')}.` };
    case z.ZodIssueCode.too_small:
      return { message: 'Valor demasiado pequeño o corto.' };
    case z.ZodIssueCode.too_big:
      return { message: 'Valor demasiado grande o largo.' };
    default:
      return { message: ctx.defaultError };
  }
});

/** '' o solo espacios → undefined (campos opcionales de formularios). */
export const emptyToUndefined = schema =>
  z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);

export const nameSchema = z.string({ required_error: 'Escribe tu nombre.' })
  .trim()
  .min(LIMITS.name.min, `El nombre debe tener al menos ${LIMITS.name.min} letras.`)
  .max(LIMITS.name.max, `El nombre no puede superar ${LIMITS.name.max} caracteres.`)
  .transform(sanitizeText)
  .refine(v => v.length >= LIMITS.name.min, 'Escribe un nombre válido.');

export const emailSchema = z.string({ required_error: 'Escribe tu correo.' })
  .trim()
  .toLowerCase()
  .max(LIMITS.email.max, 'El correo es demasiado largo.')
  .regex(EMAIL_RE, 'Revisa el correo: debe tener el formato nombre@dominio.com.');

export const phoneSchema = emptyToUndefined(
  z.string().trim().regex(PHONE_RE, 'Usa solo números, espacios o guiones (mínimo 7 dígitos).').optional()
);

export const slugSchema = z.string().trim().toLowerCase().max(80).regex(SLUG_RE, 'Identificador no válido.');

/** Texto libre opcional con saneado anti-XSS. */
export const freeText = (max, message) => emptyToUndefined(
  z.string().trim().max(max, message).transform(sanitizeText).optional()
);

/** Campo trampa: los humanos no lo ven, los bots lo rellenan. */
export const honeypot = z.string().max(0, 'Solicitud rechazada.').optional();

export const startDateSchema = z.string({ required_error: 'Elige la fecha de salida.' })
  .regex(ISO_DATE_RE, 'Usa el formato AAAA-MM-DD.')
  .superRefine((value, ctx) => {
    if (!parseISODate(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Esa fecha no existe.' });
      return;
    }
    const today = toISODate(new Date());
    // Un día de margen por la diferencia de zona horaria entre cliente y servidor
    if (value < addDays(today, LIMITS.bookingLeadDays - 1)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `La salida debe ser al menos ${LIMITS.bookingLeadDays} días después de hoy.` });
    } else if (value > addDays(today, LIMITS.bookingHorizonDays)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Todavía no abrimos reservas para esa fecha.' });
    }
  });

export const travelersSchema = z.number({ required_error: 'Indica cuántos viajeros sois.', invalid_type_error: 'Indica un número de viajeros.' })
  .int()
  .min(LIMITS.travelers.min, 'Al menos 1 viajero.')
  .max(LIMITS.travelers.max, `Para grupos de más de ${LIMITS.travelers.max}, escríbenos directamente.`);

export const paginationSchema = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12)
};
