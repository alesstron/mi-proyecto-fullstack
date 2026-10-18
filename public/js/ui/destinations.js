/* =========================================================
   Destinos: tarjetas con tilt 3D, brillo que sigue al cursor,
   imagen con "blur-up" al cargar y filtros con animación FLIP.
   El filtrado es instantáneo en cliente y además consulta la
   API para incorporar destinos que no venían en la carga inicial.
   ========================================================= */
import { $, $$, EASE, esc, money, motion, finePointer } from '../core/dom.js';
import { api } from '../core/api.js';
import { store, packageForDestination } from '../core/store.js';
import { openDrawer } from './drawer.js';
import { CATEGORY_LABELS } from '../../shared/constraints.js';

const grid = $('#destGrid');
const filters = $('#filters');
const pill = $('.filter-pill', filters);
let currentFilter = 'todos';
let onlySlugs = null;

function cardHtml(d) {
  const tags = d.categories.map(c => CATEGORY_LABELS[c] ?? c).join(' y ');
  const img = d.cover
    ? `<img src="${esc(d.cover.src)}" srcset="${esc(d.cover.srcset)}" sizes="(max-width: 620px) 92vw, (max-width: 1080px) 46vw, 380px" alt="Paisaje de ${esc(d.title)}" loading="lazy" decoding="async" width="800" height="680">`
    : '';
  return `
  <article class="dest-card" data-slug="${esc(d.slug)}" data-cats="${esc(d.categories.join(' '))}">
    <div class="dest-inner">
      <div class="dest-media" style="--fallback:${esc(d.gradient ?? 'var(--accent-soft)')}">
        <span class="emoji" aria-hidden="true">${esc(d.emoji ?? '')}</span>
        ${img}
        <span class="dest-tag">${esc(tags)}</span>
        <span class="dest-shine" aria-hidden="true"></span>
      </div>
      <div class="dest-body">
        <h3>${esc(d.title)}</h3>
        <p>${esc(d.country)}${d.days ? `, ${d.days} días` : ''} · <span class="rating" aria-label="Valoración ${d.rating} de 5">★ ${esc(d.rating?.toFixed(1) ?? '')}</span></p>
        ${d.fromPrice ? `<div class="dest-price">desde<strong>${money(d.fromPrice)}</strong></div>` : ''}
      </div>
      <a class="btn dest-cta" href="/destinos/${esc(d.slug)}" data-dest="${esc(d.slug)}" aria-label="Ver paquete de ${esc(d.title)}">Ver paquete</a>
    </div>
  </article>`;
}

function bindTilt(card) {
  if (!finePointer) return;
  const inner = $('.dest-inner', card);
  card.addEventListener('pointermove', e => {
    if (motion.reduced) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.classList.add('is-tilting');
    inner.style.transform = `rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg) translateZ(0)`;
    inner.style.setProperty('--mx', px * 100 + '%');
    inner.style.setProperty('--my', py * 100 + '%');
  });
  card.addEventListener('pointerleave', () => { card.classList.remove('is-tilting'); inner.style.transform = ''; });
}

function appendCards(list) {
  const tmp = document.createElement('div');
  tmp.innerHTML = list.map(cardHtml).join('');
  const cards = [...tmp.children];
  cards.forEach(c => { grid.appendChild(c); bindTilt(c); });
  // Las imágenes ya en caché no disparan "load": se marcan al momento
  cards.forEach(c => { const img = $('img', c); if (img?.complete && img.naturalWidth) img.classList.add('is-loaded'); });
}

function movePill(btn, instant) {
  if (!btn) { pill.style.width = '0px'; return; }
  if (instant) pill.style.transition = 'none';
  pill.style.width = btn.offsetWidth + 'px';
  pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
}

const matches = card => {
  if (onlySlugs) return onlySlugs.includes(card.dataset.slug);
  return currentFilter === 'todos' || card.dataset.cats.split(' ').includes(currentFilter);
};

/** Filtrado con FLIP: los que salen se desvanecen y los que quedan se deslizan a su nuevo sitio. */
function applyFilter(statusText) {
  const cards = $$('.dest-card', grid);
  const first = new Map(cards.filter(c => !c.hidden).map(c => [c, c.getBoundingClientRect()]));
  const leaving = cards.filter(c => !c.hidden && !matches(c));
  leaving.forEach(c => c.classList.add('is-leaving'));

  setTimeout(() => {
    cards.forEach(c => { c.hidden = !matches(c); c.classList.remove('is-leaving'); });
    cards.filter(c => !c.hidden).forEach(c => {
      if (motion.reduced) return;
      const f = first.get(c), l = c.getBoundingClientRect();
      if (f) {
        const dx = f.left - l.left, dy = f.top - l.top;
        if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 420, easing: EASE });
      } else {
        c.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
      }
    });
    const n = cards.filter(c => !c.hidden).length;
    $('#filterStatus').textContent = statusText ?? `${n} ${n === 1 ? 'destino' : 'destinos'} mostrados`;
  }, leaving.length && !motion.reduced ? 160 : 0);
}

/** Muestra solo los destinos de una búsqueda (desde el buscador del hero). */
export function showOnly(slugs) {
  onlySlugs = slugs;
  $$('.filter', filters).forEach(f => f.setAttribute('aria-pressed', 'false'));
  movePill(null);
  applyFilter(`${slugs.length} destinos coinciden con tu búsqueda`);
}

export function initDestinations() {
  grid.innerHTML = '';
  grid.removeAttribute('aria-busy');
  appendCards(store.destinations);

  // Blur-up al cargar y gradiente de respaldo si la imagen falla
  grid.addEventListener('load', e => { if (e.target.tagName === 'IMG') e.target.classList.add('is-loaded'); }, true);
  grid.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.remove(); }, true);

  grid.addEventListener('click', e => {
    const a = e.target.closest('.dest-cta');
    if (!a) return;
    e.preventDefault();
    openDrawer(packageForDestination(a.dataset.dest), a);
  });

  requestAnimationFrame(() => movePill($('[aria-pressed="true"]', filters), true));
  addEventListener('resize', () => movePill($('[aria-pressed="true"]', filters), true));
  document.fonts?.ready.then(() => movePill($('[aria-pressed="true"]', filters), true));

  filters.addEventListener('click', async e => {
    const b = e.target.closest('.filter');
    if (!b || (b.getAttribute('aria-pressed') === 'true' && !onlySlugs)) return;
    $$('.filter', filters).forEach(f => f.setAttribute('aria-pressed', String(f === b)));
    movePill(b);
    currentFilter = b.dataset.filter;
    onlySlugs = null;
    applyFilter();

    // Sincroniza con la base de datos sin bloquear la animación
    if (currentFilter === 'todos' || store.source === 'fallback') return;
    try {
      const res = await api('/api/destinations', { query: { category: currentFilter, limit: 24 } });
      const known = new Set(store.destinations.map(d => d.slug));
      const fresh = res.data.filter(d => !known.has(d.slug));
      if (fresh.length) {
        store.destinations.push(...fresh);
        appendCards(fresh);
        applyFilter();
      }
    } catch { /* el filtrado local ya está aplicado */ }
  });
}
