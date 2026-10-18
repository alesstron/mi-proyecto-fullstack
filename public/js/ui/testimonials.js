/* =========================================================
   Testimonios (desde la BD): slider con avatares apilados que se
   pausa con hover/foco + formulario de opinión con estrellas.
   ========================================================= */
import { $, $$, esc, motion, setLoading } from '../core/dom.js';
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from './toast.js';
import { createValidator, setFieldError } from './forms.js';
import { LIMITS } from '../../shared/constraints.js';

const PALETTE = ['#FF9EB7', '#9FD8F5', '#C6EBD7', '#F5B841', '#FFD0A6', '#D9C6F5'];
const colorFor = name => PALETTE[[...name].reduce((a, c) => a + c.codePointAt(0), 0) % PALETTE.length];
const initials = name => name.split(/\s+/).filter(w => /\p{L}/u.test(w[0] ?? '')).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);

function initSlider() {
  const slides = $('#slides'), avatars = $('#avatars'), reviews = store.reviews;
  if (store.reviewSummary?.count) {
    const s = $('#testiSummary');
    s.innerHTML = `<span class="mini-stars" aria-hidden="true">★</span> ${String(store.reviewSummary.average).replace('.', ',')} de media en ${store.reviewSummary.count} opiniones verificadas`;
    s.hidden = false;
  }
  if (!reviews.length) {
    slides.innerHTML = '<p class="empty">Aún no hay opiniones publicadas. ¡Sé la primera persona en contar tu viaje!</p>';
    $('.testi-ctrl').hidden = true;
    return;
  }

  slides.innerHTML = reviews.map((r, i) => `
    <figure class="slide${i === 0 ? ' is-active' : ''}" aria-roledescription="opinión" aria-label="${i + 1} de ${reviews.length}" ${i ? 'aria-hidden="true"' : ''}>
      <blockquote>“${esc(r.comment)}”</blockquote>
      <figcaption>
        <span class="mini-stars" role="img" aria-label="${r.rating} de 5 estrellas">${stars(r.rating)}</span>
        <span><strong>${esc(r.authorName)}</strong>${r.authorLocation ? `, ${esc(r.authorLocation)}` : ''}.${r.destination ? ` Viajó a ${esc(r.destination.title)}.` : ''}</span>
      </figcaption>
    </figure>`).join('');
  avatars.innerHTML = reviews.map((r, i) => `
    <button class="avatar" type="button" style="--c:${colorFor(r.authorName)};z-index:${reviews.length - i}" aria-label="Ver opinión de ${esc(r.authorName)}" ${i === 0 ? 'aria-current="true"' : ''}>
      ${r.avatarUrl ? `<img src="${esc(r.avatarUrl)}" alt="" loading="lazy" width="54" height="54">` : esc(initials(r.authorName))}
    </button>`).join('');

  const sEls = $$('.slide', slides), aEls = $$('.avatar', avatars);
  let idx = 0, timer;
  $('#tCount').textContent = `1 / ${sEls.length}`;

  function go(n) {
    n = (n + sEls.length) % sEls.length;
    if (n === idx) return;
    const old = sEls[idx];
    old.classList.add('is-out');
    old.classList.remove('is-active');
    old.setAttribute('aria-hidden', 'true');
    setTimeout(() => old.classList.remove('is-out'), 420);
    sEls[n].classList.add('is-active');
    sEls[n].removeAttribute('aria-hidden');
    aEls.forEach((a, i) => (i === n ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    idx = n;
    $('#tCount').textContent = `${n + 1} / ${sEls.length}`;
  }
  aEls.forEach((a, i) => a.addEventListener('click', () => { go(i); restart(); }));
  $('#tPrev').addEventListener('click', () => { go(idx - 1); restart(); });
  $('#tNext').addEventListener('click', () => { go(idx + 1); restart(); });

  const wrap = $('.testi-wrap');
  function restart() { clearInterval(timer); if (!motion.reduced && sEls.length > 1) timer = setInterval(() => go(idx + 1), 7000); }
  wrap.addEventListener('pointerenter', () => clearInterval(timer));
  wrap.addEventListener('pointerleave', restart);
  wrap.addEventListener('focusin', () => clearInterval(timer));
  wrap.addEventListener('focusout', restart);
  restart();
}

/* ---------- Formulario de opinión ---------- */
const WORDS = ['', 'Mejorable', 'Correcto', 'Bueno', 'Muy bueno', '¡Inolvidable!'];

function initReviewForm() {
  const toggle = $('#reviewToggle'), panel = $('#reviewPanel'), form = $('#reviewForm');
  const v = createValidator(form);
  const starsWrap = $('#ratingStars'), labels = $$('label', starsWrap), word = $('#ratingWord');
  const comment = $('#rvComment'), counter = $('#rvCount');

  $('#rvDest').insertAdjacentHTML('beforeend', store.destinations.map(d => `<option value="${esc(d.slug)}">${esc(d.title)}</option>`).join(''));

  // Panel plegable (grid-template-rows 0fr → 1fr) con inert cuando está cerrado
  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
    panel.toggleAttribute('inert', !open);
    if (open) setTimeout(() => $('#r5').focus({ preventScroll: true }), motion.reduced ? 0 : 250);
  }
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));

  // Estrellas: previsualización al pasar el cursor, "pop" al elegir
  const selected = () => +(form.elements.namedItem('rating').value || 0);
  const light = n => {
    labels.forEach(l => l.classList.toggle('is-lit', +l.dataset.n <= n));
    word.textContent = WORDS[n];
  };
  labels.forEach(l => l.addEventListener('pointerenter', () => light(+l.dataset.n)));
  starsWrap.addEventListener('pointerleave', () => light(selected()));
  starsWrap.addEventListener('change', () => {
    const n = selected();
    light(n);
    setFieldError($('#r1'), '');
    const lbl = labels[n - 1];
    if (!motion.reduced) lbl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  });

  comment.addEventListener('input', () => {
    const n = comment.value.length;
    counter.textContent = `${n} / ${LIMITS.comment.max}`;
    counter.classList.toggle('is-near', n > LIMITS.comment.max * 0.9);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let bad = v.validateAll();
    if (!selected()) {
      setFieldError($('#r1'), 'Elige de 1 a 5 estrellas.');
      bad ||= $('#r5');
    }
    if (bad) { bad.focus(); return; }
    const f = name => form.elements.namedItem(name);
    const body = {
      authorName: f('authorName').value.trim(),
      authorLocation: f('authorLocation').value.trim(),
      rating: selected(),
      comment: comment.value.trim(),
      ...(f('destinationSlug').value && { destinationSlug: f('destinationSlug').value }),
      website: f('website').value
    };
    const btn = $('#reviewBtn');
    setLoading(btn, true, 'Enviando…');
    try {
      const res = await api('/api/reviews', { method: 'POST', body });
      toast({ type: 'success', title: '¡Gracias por contarlo!', desc: res.message });
      v.reset();
      light(0);
      counter.textContent = `0 / ${LIMITS.comment.max}`;
      setOpen(false);
      toggle.focus();
    } catch (err) {
      v.showServerErrors(err.details)?.focus();
      toast({ type: 'error', title: err.status === 429 ? 'Ya recibimos tus opiniones' : 'No pudimos enviar tu opinión', desc: err.message });
    } finally {
      setLoading(btn, false);
    }
  });
}

export function initTestimonials() {
  initSlider();
  initReviewForm();
}
