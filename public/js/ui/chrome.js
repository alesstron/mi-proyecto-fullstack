/* =========================================================
   Piezas globales: tema, navegación, botones magnéticos,
   revelado al scroll y detalles del footer.
   ========================================================= */
import { $, $$, EASE, motion, finePointer } from '../core/dom.js';

/* ---------- Tema claro / oscuro (View Transitions si existe) ---------- */
export function initTheme() {
  const btn = $('#themeToggle');
  const root = document.documentElement;
  const sync = () => btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('rn-theme', next); } catch { /* modo privado */ }
      sync();
    };
    if (document.startViewTransition && !motion.reduced) document.startViewTransition(apply);
    else apply();
  });
}

/* ---------- Navegación: fondo translúcido al hacer scroll ---------- */
export function initNav() {
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 12);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Botones magnéticos: el contenido se mueve más que el botón ---------- */
export function initMagnetic(scope = document) {
  if (!finePointer) return;
  $$('.magnetic', scope).forEach(btn => {
    if (btn.dataset.magnetic) return;
    btn.dataset.magnetic = '1';
    const inner = $('.mag-inner', btn);
    btn.addEventListener('pointermove', e => {
      if (motion.reduced || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      btn.style.transition = 'transform 120ms linear';
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
      if (inner) inner.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transition = `transform 400ms ${EASE}`;
      btn.style.transform = '';
      if (inner) inner.style.transform = '';
    });
    btn.addEventListener('pointerdown', () => { btn.style.transform += ' scale(.97)'; });
  });
}

/* ---------- Revelado al hacer scroll (IntersectionObserver) ---------- */
export function initReveal() {
  const els = $$('[data-reveal]');
  if (motion.reduced || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  els.forEach(e => io.observe(e));
}

/* ---------- Footer: wordmark reactivo y volver arriba ---------- */
export function initFooter() {
  const wm = $('#wordmark');
  wm.innerHTML = [...wm.textContent].map(c => (c === ' ' ? ' ' : `<span>${c}</span>`)).join('');
  $('#toTop').addEventListener('click', () => {
    scrollTo({ top: 0, behavior: motion.reduced ? 'auto' : 'smooth' });
    $('.logo').focus({ preventScroll: true });
  });
}
