/* =========================================================
   Hero: titular con stagger por letras (máscara por palabra),
   parallax suave del fondo y buscador conectado a la API.
   ========================================================= */
import { $, $$, EASE, esc, motion, shake, scrollToEl, setLoading, emit } from '../core/dom.js';
import { api } from '../core/api.js';
import { store, searchLocal, packageForDestination } from '../core/store.js';
import { toast } from './toast.js';
import { openDrawer } from './drawer.js';
import { showOnly } from './destinations.js';
import { LIMITS, addDays, localToday, parseISODate } from '../../shared/constraints.js';

export function initHeroVisuals() {
  // Titular partido en letras; el lector de pantalla lee la frase completa
  const el = $('[data-split]');
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let i = 0;
  text.split(' ').forEach((word, wi, arr) => {
    const w = document.createElement('span');
    w.className = 'w';
    w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i++);
      s.textContent = ch;
      w.appendChild(s);
    }
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });

  // Parallax por capas con requestAnimationFrame
  const layers = $$('.hero-bg .layer');
  const hero = $('.hero');
  let ticking = false;
  function update() {
    ticking = false;
    if (motion.reduced || scrollY > hero.offsetHeight * 1.2) return;
    layers.forEach(l => { l.style.transform = `translate3d(0, ${scrollY * parseFloat(l.dataset.depth)}px, 0)`; });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

const IATA = {
  'ciudad de méxico': 'MEX', madrid: 'MAD', 'bogotá': 'BOG', 'buenos aires': 'EZE', santiago: 'SCL', lima: 'LIM', barcelona: 'BCN',
  'cancún': 'CUN', cancun: 'CUN', 'machu picchu': 'CUZ', santorini: 'JTR', tokio: 'HND', patagonia: 'FTE', bali: 'DPS'
};
const toCode = v => {
  const k = v.trim().toLowerCase();
  if (!k) return '???';
  return IATA[k] || k.normalize('NFD').replace(/[^a-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, '?');
};
function setCode(box, code) {
  [...box.children].forEach((s, i) => {
    if (s.textContent === code[i]) return;
    s.textContent = code[i];
    if (!motion.reduced) s.animate([{ transform: 'translateY(-55%) rotateX(80deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: i * 45, easing: EASE, fill: 'backwards' });
  });
}

export function initSearch() {
  const form = $('#searchForm'), origin = $('#sOrigin'), dest = $('#sDest'), from = $('#sFrom'), to = $('#sTo'), pax = $('#sPax');
  const btn = $('#searchBtn');

  // El autocompletado sale de los destinos reales
  $('#destList').innerHTML = store.destinations.map(d => `<option value="${esc(d.title)}"></option>`).join('');

  origin.addEventListener('change', () => setCode($('#codeFrom'), toCode(origin.value)));
  dest.addEventListener('input', () => { setCode($('#codeTo'), toCode(dest.value)); $('#destField').classList.remove('is-invalid'); });
  pax.addEventListener('change', () => { $('#stubPax').textContent = pax.value + ' pax'; });

  const minDate = addDays(localToday(), LIMITS.bookingLeadDays);
  from.min = minDate;
  to.min = minDate;
  from.addEventListener('change', () => {
    to.min = from.value ? addDays(from.value, 2) : minDate;
    if (to.value && to.value < to.min) to.value = '';
    $('#fromField').classList.remove('is-invalid');
  });

  const fail = (field, title, desc) => {
    field?.classList.add('is-invalid');
    shake(form);
    toast({ type: 'error', title, desc });
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const term = dest.value.trim();
    if (!term) { dest.focus(); return fail($('#destField'), 'Falta el destino', 'Escribe a dónde quieres ir o elige uno de la lista.'); }
    if (from.value && (!parseISODate(from.value) || from.value < minDate)) {
      from.focus();
      return fail($('#fromField'), 'Revisa la fecha de ida', `Reservamos con al menos ${LIMITS.bookingLeadDays} días de antelación.`);
    }
    const maxDays = from.value && to.value
      ? Math.round((parseISODate(to.value) - parseISODate(from.value)) / 864e5) + 1
      : undefined;

    setLoading(btn, true, 'Buscando…');
    let results;
    try {
      results = (await api('/api/destinations', { query: { search: term, maxDays, limit: 6 } })).data;
    } catch (err) {
      if (err.status === 400) { setLoading(btn, false); return fail($('#destField'), 'Búsqueda no válida', err.message); }
      results = searchLocal(term, maxDays);
    } finally {
      setLoading(btn, false);
    }

    const travelers = +pax.value;
    if (!results.length) {
      return fail($('#destField'), `No encontramos «${term}»`,
        maxDays ? `No hay viajes de hasta ${maxDays} días con ese destino. Prueba otras fechas.` : 'Prueba con Cancún, Tokio, Patagonia…');
    }

    emit('rn:prefill', { startDate: from.value || undefined, travelers });
    if (results.length === 1) {
      const d = results[0];
      openDrawer(packageForDestination(d.slug), btn, { startDate: from.value, travelers });
      toast({ type: 'success', title: `Viajes a ${d.title}`, desc: `${travelers} ${travelers === 1 ? 'viajero' : 'viajeros'} desde ${origin.value}.` });
    } else {
      showOnly(results.map(d => d.slug));
      scrollToEl($('#destinos'));
      toast({ type: 'info', title: `${results.length} destinos coinciden`, desc: 'Te los mostramos en la sección de destinos.' });
    }
  });
}
