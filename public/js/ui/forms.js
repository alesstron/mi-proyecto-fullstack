/* =========================================================
   Validación en vivo compartida por los formularios.
   Mismas reglas que el servidor (shared/constraints.js):
   - se valida al salir del campo y, desde entonces, al escribir;
   - al enviar se marcan todos y los erróneos hacen "shake";
   - los errores 400 del servidor se pintan en su campo.
   ========================================================= */
import { $, $$, shake, fmtDate } from '../core/dom.js';
import { LIMITS, EMAIL_RE, PHONE_RE, parseISODate, addDays, localToday } from '../../shared/constraints.js';

export const RULES = {
  name: v => (v.trim().length >= LIMITS.name.min ? '' : `Escribe tu nombre (al menos ${LIMITS.name.min} letras).`),
  email: v => (EMAIL_RE.test(v.trim()) ? '' : 'Revisa el correo: debe tener el formato nombre@dominio.com.'),
  phone: v => (!v.trim() || PHONE_RE.test(v.trim()) ? '' : 'Usa solo números, espacios o guiones (mínimo 7 dígitos).'),
  notes: v => (v.length <= LIMITS.notes.max ? '' : `Máximo ${LIMITS.notes.max} caracteres.`),
  location: v => (v.trim().length <= LIMITS.location.max ? '' : `Máximo ${LIMITS.location.max} caracteres.`),
  required: v => (v ? '' : 'Elige una opción.'),
  comment: v => {
    const n = v.trim().length;
    if (n < LIMITS.comment.min) return `Cuéntanos un poco más: faltan ${LIMITS.comment.min - n} caracteres.`;
    return n > LIMITS.comment.max ? `Máximo ${LIMITS.comment.max} caracteres.` : '';
  },
  date: v => {
    if (!v) return 'Elige la fecha de salida.';
    if (!parseISODate(v)) return 'Esa fecha no es válida.';
    const min = addDays(localToday(), LIMITS.bookingLeadDays);
    if (v < min) return `Reservamos con antelación: elige a partir del ${fmtDate(min)}.`;
    if (v > addDays(localToday(), LIMITS.bookingHorizonDays)) return 'Todavía no abrimos reservas para esa fecha.';
    return '';
  }
};

const OPTIONAL = new Set(['phone', 'notes', 'location']);
const NO_CHECK = new Set(['required', 'date', 'notes']);

function wrapOf(input) {
  return input.closest('.fl, .rating-input');
}

export function setFieldError(input, msg) {
  const wrap = wrapOf(input);
  if (!wrap) return;
  const optionalEmpty = OPTIONAL.has(input.dataset.rule) && !input.value.trim();
  wrap.classList.toggle('is-invalid', Boolean(msg));
  wrap.classList.toggle('is-valid', !msg && !optionalEmpty && !NO_CHECK.has(input.dataset.rule) && wrap.classList.contains('fl'));
  input.setAttribute('aria-invalid', String(Boolean(msg)));
  const err = $('.err', wrap);
  if (err) err.textContent = msg;
}

export function createValidator(form) {
  const fields = $$('[data-rule]', form);
  const check = (input, show = true) => {
    const msg = RULES[input.dataset.rule](input.value);
    if (show) setFieldError(input, msg);
    return !msg;
  };

  fields.forEach(f => {
    const instant = f.tagName === 'SELECT' || f.type === 'date';
    f.addEventListener('blur', () => { if (f.value) { f.dataset.touched = '1'; check(f); } });
    f.addEventListener(instant ? 'change' : 'input', () => {
      if (instant) f.dataset.touched = '1';
      if (f.dataset.touched) check(f);
    });
  });

  return {
    /** Devuelve el primer campo inválido (o null). */
    validateAll() {
      let first = null;
      fields.forEach(f => {
        f.dataset.touched = '1';
        if (!check(f)) { first ||= f; shake(wrapOf(f)); }
      });
      return first;
    },
    /** Pinta los errores { field, message } devueltos por la API. */
    showServerErrors(details = []) {
      let first = null;
      for (const d of details ?? []) {
        let el = d.field ? form.elements.namedItem(d.field) : null;
        if (el instanceof RadioNodeList) el = el[0];
        if (!el || !wrapOf(el)) continue;
        setFieldError(el, d.message);
        shake(wrapOf(el));
        first ||= el;
      }
      return first;
    },
    reset() {
      form.reset();
      fields.forEach(f => {
        delete f.dataset.touched;
        wrapOf(f)?.classList.remove('is-valid', 'is-invalid');
        f.removeAttribute('aria-invalid');
      });
    }
  };
}
