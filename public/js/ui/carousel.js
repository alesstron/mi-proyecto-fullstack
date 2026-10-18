/* =========================================================
   Explorador: carrusel arrastrable con inercia proyectada,
   resistencia elástica en los bordes, snap y teclado.
   ========================================================= */
import { $, $$, EASE, clamp, esc, money, motion } from '../core/dom.js';
import { store, packageBySlug } from '../core/store.js';
import { openDrawer } from './drawer.js';

export function initCarousel() {
  const track = $('#track'), viewport = $('#viewport');
  track.innerHTML = store.packages.map(p => `
    <button class="pkg" type="button" data-slug="${esc(p.slug)}" aria-label="${esc(p.title)}: ${esc(p.route)}, ${p.days} días, desde ${money(p.pricePerPerson)}. Ver detalles">
      <div class="pkg-art" style="--g:${esc(p.destination.gradient ?? 'var(--accent-soft)')}" aria-hidden="true"><span class="emoji">${esc(p.emoji ?? '')}</span><span class="pkg-days">${p.days} días</span></div>
      <div class="pkg-body" aria-hidden="true">
        <h3>${esc(p.title)}</h3>
        <p class="pkg-route">${esc(p.route)}</p>
        <div class="pkg-foot"><span>desde <strong>${money(p.pricePerPerson)}</strong></span><span class="pkg-more">Ver itinerario</span></div>
      </div>
    </button>`).join('');

  let x = 0, min = 0, snaps = [];
  let dragging = false, captured = false, startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0, moved = 0;
  let suppressClick = false;
  const cards = $$('.pkg', track);
  const prev = $('#prevPkg'), next = $('#nextPkg'), bar = $('#progressBar');

  function measure() {
    const pad = parseFloat(getComputedStyle(track).paddingLeft);
    min = Math.min(0, viewport.clientWidth - track.scrollWidth);
    snaps = cards.map(c => clamp(-(c.offsetLeft - pad), min, 0));
    snaps.push(min);
    snaps = [...new Set(snaps.map(Math.round))].sort((a, b) => b - a);
    setX(clamp(x, min, 0), false);
  }
  function setX(v, animate, dur = 550) {
    x = v;
    track.style.transition = animate && !motion.reduced ? `transform ${dur}ms ${EASE}` : 'none';
    track.style.transform = `translate3d(${x}px,0,0)`;
    const p = min === 0 ? 1 : x / min;
    bar.style.transform = `scaleX(${0.15 + 0.85 * p})`;
    prev.disabled = x >= -1;
    next.disabled = x <= min + 1;
  }
  const nearest = v => snaps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), snaps[0]);
  function step(dir) {
    const i = snaps.indexOf(nearest(x));
    setX(snaps[clamp(i + dir, 0, snaps.length - 1)], true);
  }

  viewport.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true; captured = false; moved = 0;
    startX = lastX = e.clientX; startPos = x; lastT = performance.now(); vel = 0;
    track.style.transition = 'none';
  });
  viewport.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (!captured && moved > 6) { viewport.setPointerCapture(e.pointerId); captured = true; viewport.classList.add('is-dragging'); }
    if (!captured) return;
    let nx = startPos + dx;
    if (nx > 0) nx *= 0.35;
    if (nx < min) nx = min + (nx - min) * 0.35;
    const now = performance.now();
    vel = (e.clientX - lastX) / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
    setX(nx, false);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    if (!captured) return;
    suppressClick = true;
    // Inercia: se proyecta la posición según la velocidad de salida y se hace snap
    const projected = x + vel * 260;
    setX(nearest(clamp(projected, min, 0)), true, clamp(420 + Math.abs(vel) * 120, 420, 750));
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('click', e => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
    const card = e.target.closest('.pkg');
    if (card) openDrawer(packageBySlug(card.dataset.slug), card);
  }, true);

  track.addEventListener('focusin', e => {
    const c = e.target.closest('.pkg');
    if (!c) return;
    viewport.scrollLeft = 0;
    const pad = parseFloat(getComputedStyle(track).paddingLeft);
    const left = c.offsetLeft + x, right = left + c.offsetWidth;
    if (left < pad || right > viewport.clientWidth - pad) setX(nearest(clamp(-(c.offsetLeft - pad), min, 0)), true);
  });
  viewport.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  addEventListener('resize', measure);
  document.fonts?.ready.then(measure);
  measure();
}
