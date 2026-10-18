/* =========================================================
   Ruta animada: el trazo se dibuja con el scroll (stroke-dashoffset),
   el avión sigue la curva y cada parada es interactiva (hover,
   foco o toque) con una tarjeta de información contextual.
   ========================================================= */
import { $, $$, clamp, motion } from '../core/dom.js';

const STOPS = [
  { name: 'Ciudad de México', note: 'Salida', x: 150, y: 170, info: 'Reunión del grupo y cena de bienvenida en la Roma.' },
  { name: 'Cancún', note: 'Días 1 a 5', x: 270, y: 205, info: 'Cenotes, Holbox y Tulum al amanecer.' },
  { name: 'Machu Picchu', note: 'Días 6 a 12', x: 300, y: 360, info: 'Aclimatación en Cusco y entrada a la ciudadela al alba.' },
  { name: 'Patagonia', note: 'Días 13 a 19', x: 330, y: 500, info: 'Perito Moreno y trekking a la Laguna de los Tres.' },
  { name: 'Santorini', note: 'Días 20 a 26', x: 590, y: 200, info: 'Tres días de velero por las Cícladas.' },
  { name: 'Tokio', note: 'Días 27 a 34', x: 860, y: 150, info: 'Izakayas, ryokan con onsen y Kioto en tren bala.' },
  { name: 'Bali', note: 'Días 35 a 42', x: 790, y: 390, info: 'Arrozales, templos de agua y despedida en Ubud.' }
];

export function initRoute() {
  const path = $('#routePath'), stopsG = $('#stops'), list = $('#routeList'), marker = $('#planeMarker');
  const section = $('#ruta'), card = $('#stopCard'), map = $('.route-map');
  const L = path.getTotalLength();
  path.style.strokeDasharray = L;
  path.style.strokeDashoffset = L;

  // Fracción del trazo en la que cae cada parada
  const fracs = STOPS.map(p => {
    let best = 0, bestD = Infinity;
    for (let s = 0; s <= 400; s++) {
      const pt = path.getPointAtLength((s / 400) * L);
      const d = (pt.x - p.x) ** 2 + (pt.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = s / 400; }
    }
    return best;
  });

  const NS = 'http://www.w3.org/2000/svg';
  const stopEls = STOPS.map((p, i) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'stop');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${p.name}, ${p.note}: ${p.info}`);
    g.innerHTML = `<circle class="hit" cx="${p.x}" cy="${p.y}" r="22"/><circle class="ring" cx="${p.x}" cy="${p.y}" r="7"/><circle class="dot" cx="${p.x}" cy="${p.y}" r="7"/>
      <text x="${p.x + 14}" y="${p.y + (i === 3 ? -12 : 5)}">${p.name}</text>`;
    stopsG.appendChild(g);
    return g;
  });
  list.innerHTML = STOPS.map((p, i) => `<li><button type="button" class="route-item" data-i="${i}"><span>${p.name}</span><small>${p.note}</small></button></li>`).join('');
  const items = $$('li', list);

  /* Tarjeta contextual posicionada sobre la parada */
  let active = -1;
  function show(i) {
    if (i === active) return;
    active = i;
    stopEls.forEach((g, k) => g.classList.toggle('is-active', k === i));
    items.forEach((li, k) => li.classList.toggle('is-active', k === i));
    if (i < 0) { card.classList.remove('is-shown'); return; }
    const p = STOPS[i];
    card.innerHTML = `<strong>${p.name}</strong><small>${p.note}</small><span>${p.info}</span>`;
    card.hidden = false;
    // Coordenadas SVG (1000×560) → porcentaje del contenedor
    card.style.setProperty('--x', (p.x / 1000) * 100 + '%');
    card.style.setProperty('--y', (p.y / 560) * 100 + '%');
    card.classList.toggle('flip-x', p.x > 700);
    card.classList.toggle('flip-y', p.y > 420);
    card.classList.remove('is-shown');
    void card.offsetWidth;
    card.classList.add('is-shown');
  }
  const hide = () => show(-1);

  stopEls.forEach((g, i) => {
    g.addEventListener('pointerenter', () => show(i));
    g.addEventListener('focus', () => show(i));
    g.addEventListener('click', () => show(i));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } });
  });
  map.addEventListener('pointerleave', hide);
  stopsG.addEventListener('focusout', e => { if (!stopsG.contains(e.relatedTarget)) hide(); });
  list.addEventListener('click', e => { const b = e.target.closest('.route-item'); if (b) show(+b.dataset.i); });
  list.addEventListener('pointerover', e => { const b = e.target.closest('.route-item'); if (b) show(+b.dataset.i); });
  list.addEventListener('pointerleave', hide);

  /* Trazo ligado al scroll */
  let ticking = false;
  function update() {
    ticking = false;
    const r = section.getBoundingClientRect();
    const vh = innerHeight;
    let p = clamp((vh * 0.75 - r.top) / (r.height * 0.7), 0, 1);
    if (motion.reduced) p = r.top < vh ? 1 : 0;
    path.style.strokeDashoffset = L * (1 - p);
    const pt = path.getPointAtLength(L * p);
    const pt2 = path.getPointAtLength(Math.min(L, L * p + 2));
    const ang = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
    marker.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`);
    marker.style.opacity = p > 0.01 && p < 0.995 ? 1 : 0;
    fracs.forEach((f, i) => {
      const reached = p >= f - 0.005;
      stopEls[i].classList.toggle('is-on', reached);
      items[i].classList.toggle('is-on', reached);
    });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}
