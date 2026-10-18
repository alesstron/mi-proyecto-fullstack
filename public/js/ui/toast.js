/* =========================================================
   Toasts apilables inspirados en Sonner.
   - Pila comprimida que se expande al pasar el cursor o enfocar.
   - Temporizadores que se pausan mientras la pila está abierta.
   - toast.promise(): un mismo toast pasa de "cargando" a éxito
     o error, con el icono haciendo un pequeño "pop".
   - Botón de acción opcional (p. ej. copiar la referencia).
   ========================================================= */
import { $, motion } from '../core/dom.js';

const toaster = $('#toaster');
const toasts = [];
let expanded = false;

const ICONS = {
  success: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.7 7.7-5.5 5.6a1 1 0 0 1-1.4 0l-2.5-2.5a1 1 0 1 1 1.4-1.4l1.8 1.8 4.8-4.9a1 1 0 0 1 1.4 1.4Z"/></svg>',
  error: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5.5a1 1 0 1 1 2 0V13a1 1 0 1 1-2 0Zm1 10.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg>',
  info: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15a1 1 0 1 1-2 0v-5a1 1 0 1 1 2 0Zm-1-8.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg>',
  loading: '<span class="ico ico-loading" aria-hidden="true"><span class="spinner"></span></span>'
};
const CLOSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

function layout() {
  let offset = 0;
  toasts.forEach((t, i) => {
    const el = t.el;
    el.style.zIndex = 100 - i;
    if (!t.mounted) return;
    let y, s, o;
    if (expanded) { y = -offset; s = 1; o = 1; offset += t.h + 10; }
    else { y = -i * 14; s = 1 - i * 0.05; o = i > 2 ? 0 : 1; }
    if (t.leaving) { y += 20; o = 0; }
    el.style.transform = `translateY(${y}px) scale(${s})`;
    el.style.opacity = o;
    el.style.pointerEvents = o ? '' : 'none';
    // En la pila comprimida, los de detrás no reciben foco
    el.toggleAttribute('inert', !expanded && i > 0 && !el.contains(document.activeElement));
  });
  // Zona sensible para expandir la pila; sin toasts no debe tapar nada
  toaster.style.setProperty('--hit', (!toasts.length ? 0 : expanded ? offset : toasts[0].h + 30) + 'px');
}

function startTimer(t) {
  clearTimeout(t.timer);
  if (!Number.isFinite(t.remaining)) return;
  t.started = Date.now();
  t.timer = setTimeout(() => dismiss(t), t.remaining);
}
function pauseTimer(t) {
  clearTimeout(t.timer);
  if (Number.isFinite(t.remaining) && t.started) t.remaining -= Date.now() - t.started;
}

function dismiss(t) {
  if (t.leaving) return;
  t.leaving = true;
  clearTimeout(t.timer);
  layout();
  setTimeout(() => {
    t.el.remove();
    toasts.splice(toasts.indexOf(t), 1);
    if (!toasts.length) expanded = false;
    layout();
  }, motion.reduced ? 0 : 300);
}

function paint(t, { title, desc = '', type = 'info', action }) {
  const el = t.el;
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.innerHTML = `${ICONS[type]}<div class="toast-body"><strong></strong>${desc ? '<p></p>' : ''}${action ? '<button class="toast-action" type="button"></button>' : ''}</div>
    <button class="toast-x" type="button" aria-label="Cerrar notificación">${CLOSE}</button>`;
  el.querySelector('strong').textContent = title;
  if (desc) el.querySelector('p').textContent = desc;
  if (action) {
    const b = el.querySelector('.toast-action');
    b.textContent = action.label;
    b.addEventListener('click', () => { action.onClick?.(); if (action.dismiss !== false) dismiss(t); });
  }
  el.querySelector('.toast-x').addEventListener('click', () => dismiss(t));
}

export function toast(opts) {
  const el = document.createElement('li');
  const t = { el, h: 0, mounted: false, remaining: opts.duration ?? (opts.type === 'error' ? 6000 : 4500) };
  if (opts.type === 'loading') t.remaining = Infinity;
  paint(t, opts);
  toaster.prepend(el);
  t.h = el.offsetHeight;
  toasts.unshift(t);
  layout();
  requestAnimationFrame(() => requestAnimationFrame(() => { t.mounted = true; layout(); }));
  if (!expanded) startTimer(t);
  if (toasts.length > 5) dismiss(toasts[toasts.length - 1]);

  return {
    dismiss: () => dismiss(t),
    /** Transforma el toast en otro estado manteniendo su posición en la pila. */
    update(next) {
      if (t.leaving) return;
      paint(t, next);
      el.classList.add('is-updated');
      t.h = el.offsetHeight;
      t.remaining = next.duration ?? (next.type === 'error' ? 6000 : 4500);
      if (next.type === 'loading') t.remaining = Infinity;
      if (!expanded) startTimer(t);
      layout();
    }
  };
}

const resolve = (v, arg) => (typeof v === 'function' ? v(arg) : v);

/** Toast ligado a una promesa: cargando → éxito / error. Devuelve la misma promesa. */
toast.promise = (promise, { loading, success, error }) => {
  const h = toast({ type: 'loading', ...resolve(loading) });
  promise.then(
    value => h.update({ type: 'success', ...resolve(success, value) }),
    err => h.update({ type: 'error', ...resolve(error, err) })
  );
  return promise;
};

function setExpanded(v) {
  if (expanded === v || !toasts.length) return;
  expanded = v;
  toasts.forEach(t => (v ? pauseTimer(t) : startTimer(t)));
  layout();
}
toaster.addEventListener('pointerenter', () => setExpanded(true));
toaster.addEventListener('pointerleave', () => setExpanded(false));
toaster.addEventListener('focusin', () => setExpanded(true));
toaster.addEventListener('focusout', e => { if (!toaster.contains(e.relatedTarget)) setExpanded(false); });
// Escape cierra el toast más reciente
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && toaster.contains(document.activeElement) && toasts[0]) dismiss(toasts[0]);
});
