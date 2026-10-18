/* =========================================================
   Utilidades de DOM, formato y movimiento compartidas.
   ========================================================= */
export const $ = (s, c = document) => c.querySelector(s);
export const $$ = (s, c = document) => [...c.querySelectorAll(s)];

export const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
/** Estado vivo: se actualiza si el usuario cambia la preferencia del sistema. */
export const motion = { reduced: mqReduce.matches };
mqReduce.addEventListener?.('change', e => { motion.reduced = e.matches; });

export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const fmt = n => Math.round(n).toLocaleString('es-MX');
export const money = n => '$' + fmt(n);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Todo dato que viene de la API pasa por aquí antes de entrar en innerHTML. */
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

export function scrollToEl(el) {
  el.scrollIntoView({ behavior: motion.reduced ? 'auto' : 'smooth', block: 'start' });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Interpolación con ease-out cuártico: los valores "frenan" al llegar. Devuelve cancelador. */
export function tween({ from, to, duration = 420, onUpdate, onDone }) {
  if (motion.reduced) { onUpdate(to); onDone?.(); return () => {}; }
  const t0 = performance.now();
  let raf = requestAnimationFrame(function step(now) {
    const t = clamp((now - t0) / duration, 0, 1);
    const k = 1 - Math.pow(1 - t, 4);
    onUpdate(from + (to - from) * k);
    if (t < 1) raf = requestAnimationFrame(step); else onDone?.();
  });
  return () => cancelAnimationFrame(raf);
}

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDateFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const fmtDate = iso => dateFmt.format(new Date(iso + 'T00:00:00Z'));
export const fmtLongDate = iso => longDateFmt.format(new Date(iso + 'T00:00:00Z'));

export const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Bus de eventos mínimo entre módulos (p. ej. "precargar el formulario de reserva"). */
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => document.addEventListener(name, e => fn(e.detail));

export function setLoading(btn, loading, label) {
  const target = btn.querySelector('.mag-inner') ?? btn;
  if (loading) {
    btn.dataset.label = target.innerHTML;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    target.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label)}`;
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (btn.dataset.label) target.innerHTML = btn.dataset.label;
  }
}
