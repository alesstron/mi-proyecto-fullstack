/* =========================================================
   Reglas de validación compartidas entre navegador y servidor.
   El front las usa para validar en vivo; el back las aplica en
   los esquemas Zod. Cambiar un límite aquí lo cambia en ambos.
   ========================================================= */

export const LIMITS = Object.freeze({
  name: { min: 2, max: 80 },
  email: { max: 254 },
  phone: { min: 7, max: 20 },
  location: { max: 60 },
  notes: { max: 1000 },
  comment: { min: 20, max: 600 },
  rating: { min: 1, max: 5 },
  travelers: { min: 1, max: 8 },
  nights: { min: 3, max: 21 },
  budget: { min: 40, max: 400 },
  search: { max: 60 },
  // Días mínimos de antelación y horizonte máximo para reservar
  bookingLeadDays: 3,
  bookingHorizonDays: 540
});

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[\d\s-]{7,20}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const CATEGORIES = Object.freeze(['playa', 'montana', 'ciudad', 'aventura']);
export const CATEGORY_LABELS = Object.freeze({
  playa: 'Playa',
  montana: 'Montaña',
  ciudad: 'Ciudad',
  aventura: 'Aventura'
});

/* ---------- Fechas en formato YYYY-MM-DD (siempre UTC) ---------- */
export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
export function parseISODate(s) {
  if (!ISO_DATE_RE.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) || toISODate(d) !== s ? null : d;
}
export function addDays(s, n) {
  const d = parseISODate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}
/** Fecha de hoy en la zona horaria del entorno (para los <input type="date">). */
export function localToday() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
