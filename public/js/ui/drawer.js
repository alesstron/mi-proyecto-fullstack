/* =========================================================
   Drawer estilo Vaul: overlay, fondo escalado desde el centro
   visible, arrastre hacia abajo para cerrar con velocidad,
   trampa de foco y URL compartible (/destinos/:slug).
   ========================================================= */
import { $, $$, clamp, esc, money, motion, emit, scrollToEl, fmtLongDate } from '../core/dom.js';
import { api } from '../core/api.js';
import { store, destinationBySlug } from '../core/store.js';
import { LIMITS, addDays, localToday } from '../../shared/constraints.js';

const drawer = $('#drawer'), overlay = $('#overlay'), page = $('#page'), root = document.documentElement;
let lastFocus = null, current = null, context = {}, closeTimer, availCtrl;
const homeTitle = document.title;
const canRoute = () => store.source !== 'fallback' && /^https?:$/.test(location.protocol);

async function showAvailability(pkg, { startDate, travelers }) {
  const el = $('#drawerAvail');
  el.hidden = true;
  if (!startDate || startDate < addDays(localToday(), LIMITS.bookingLeadDays)) return;
  availCtrl?.abort();
  availCtrl = new AbortController();
  try {
    const { data } = await api(`/api/packages/${pkg.slug}/availability`, { query: { startDate }, signal: availCtrl.signal });
    const enough = data.seatsLeft >= (travelers || 1);
    el.dataset.state = enough ? 'ok' : 'full';
    el.textContent = data.seatsLeft === 0
      ? `La salida del ${fmtLongDate(startDate)} está completa. Prueba otra fecha.`
      : `Salida el ${fmtLongDate(startDate)}: quedan ${data.seatsLeft} de ${data.maxGroupSize} plazas${enough ? '' : ` (buscas ${travelers})`}.`;
    el.hidden = false;
  } catch { /* sin datos de disponibilidad no mostramos nada */ }
}

export function openDrawer(pkg, trigger, ctx = {}) {
  if (!pkg) return;
  clearTimeout(closeTimer);
  current = pkg;
  context = ctx;
  const dest = destinationBySlug(pkg.destination.slug);

  const art = $('#drawerArt');
  art.style.setProperty('--g', pkg.destination.gradient ?? 'var(--accent-soft)');
  art.innerHTML = pkg.cover
    ? `<img src="${esc(pkg.cover.src)}" srcset="${esc(pkg.cover.srcset)}" sizes="(max-width: 620px) 92vw, 520px" alt="" decoding="async">`
    : esc(pkg.emoji ?? pkg.destination.emoji ?? '');
  $('#drawerTitle').textContent = pkg.title;
  $('#drawerRoute').textContent = `${pkg.route} · ${pkg.days} días`;
  $('#drawerDesc').textContent = dest?.description ?? '';
  $('#drawerDays').innerHTML = pkg.itinerary.map(d => `<li><div><strong>${esc(d.title)}</strong><span>${esc(d.description)}</span></div></li>`).join('');
  $('#drawerIncl').innerHTML = pkg.includes.map(t => `<li>${esc(t)}</li>`).join('');
  $('#drawerPrice').textContent = money(pkg.pricePerPerson);
  $('#drawerGroup').textContent = `Grupos de máximo ${pkg.maxGroupSize} · IVA aparte`;
  $('#drawerScroll').scrollTop = 0;
  showAvailability(pkg, ctx);
  lastFocus = trigger || document.activeElement;

  if (canRoute()) {
    history.replaceState(history.state, '', `/destinos/${pkg.destination.slug}`);
    document.title = `${pkg.destination.title}: ${pkg.title} | Rumbo Nómada`;
  }

  // Como en Vaul, el fondo se escala desde el centro de lo que se ve
  page.style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
  document.body.style.paddingRight = innerWidth - root.clientWidth + 'px';
  overlay.hidden = false;
  drawer.hidden = false;
  drawer.style.transform = '';
  void drawer.offsetHeight;
  root.classList.add('drawer-open');
  page.setAttribute('inert', '');
  setTimeout(() => $('#drawerClose').focus({ preventScroll: true }), 60);
}

export function closeDrawer() {
  if (!root.classList.contains('drawer-open')) return;
  drawer.style.transform = '';
  overlay.style.opacity = '';
  root.classList.remove('drawer-open');
  page.removeAttribute('inert');
  if (canRoute() && location.pathname.startsWith('/destinos/')) {
    history.replaceState(history.state, '', '/' + location.hash);
    document.title = homeTitle;
  }
  closeTimer = setTimeout(() => {
    drawer.hidden = true;
    overlay.hidden = true;
    document.body.style.paddingRight = '';
    page.style.transformOrigin = '';
  }, motion.reduced ? 0 : 500);
  lastFocus?.focus({ preventScroll: true });
}

export function initDrawer() {
  overlay.addEventListener('click', closeDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);

  $('#drawerBook').addEventListener('click', () => {
    const pkg = current;
    emit('rn:prefill', { packageSlug: pkg.slug, startDate: context.startDate, travelers: context.travelers });
    lastFocus = null;
    closeDrawer();
    // El formulario precargado ya "late" y recibe el foco: no hace falta un toast que tape el botón de envío
    setTimeout(() => { scrollToEl($('#reserva')); $('#bName').focus({ preventScroll: true }); }, motion.reduced ? 0 : 320);
  });

  document.addEventListener('keydown', e => {
    if (!root.classList.contains('drawer-open')) return;
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'Tab') {
      const f = $$('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])', drawer).filter(el => !el.disabled && el.offsetParent);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Arrastrar hacia abajo para cerrar (con resistencia hacia arriba y umbral de velocidad)
  let y0 = 0, dy = 0, t0 = 0, active = false;
  const scroller = $('#drawerScroll');
  drawer.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a, input, select, textarea')) return;
    if (scroller.contains(e.target) && scroller.scrollTop > 0) return;
    active = true; y0 = e.clientY; dy = 0; t0 = performance.now();
    drawer.setPointerCapture(e.pointerId);
  });
  drawer.addEventListener('pointermove', e => {
    if (!active) return;
    dy = e.clientY - y0;
    drawer.classList.add('is-dragging');
    drawer.style.transform = `translateY(${dy > 0 ? dy : dy * 0.15}px)`;
    overlay.style.transition = 'none';
    overlay.style.opacity = String(1 - clamp(dy / drawer.offsetHeight, 0, 1));
  });
  const release = () => {
    if (!active) return;
    active = false;
    drawer.classList.remove('is-dragging');
    overlay.style.transition = '';
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > drawer.offsetHeight * 0.28 || (v > 0.55 && dy > 20)) {
      closeDrawer();
      drawer.style.transform = 'translateY(100%)';
    } else {
      drawer.style.transform = '';
      overlay.style.opacity = '';
    }
  };
  drawer.addEventListener('pointerup', release);
  drawer.addEventListener('pointercancel', release);
}
