/* Bento "Por qué elegirnos": relojes en vivo, interruptor de cancelación y contador. */
import { $, EASE, motion, fmt, tween } from '../core/dom.js';

export function initBento() {
  const zones = [['#clkMex', 'America/Mexico_City'], ['#clkMad', 'Europe/Madrid'], ['#clkTyo', 'Asia/Tokyo']];
  const fmts = zones.map(([, tz]) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }));
  function tickClocks() {
    const now = new Date();
    zones.forEach(([sel], i) => {
      const el = $(sel);
      const v = fmts[i].format(now);
      if (el.textContent === v) return;
      el.textContent = v;
      if (!motion.reduced && el.dataset.ready) el.animate([{ transform: 'translateY(-40%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
      el.dataset.ready = '1';
    });
  }
  tickClocks();
  setInterval(tickClocks, 1000);

  // Interruptor de cancelación con número animado
  const sw = $('#flexSwitch'), num = $('#refundNum');
  let cur = 100, cancel = () => {};
  sw.addEventListener('click', () => {
    const on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(on));
    $('#refundText').textContent = on ? 'de reembolso si cancelas hasta 30 días antes.' : 'de reembolso sin la cobertura flexible.';
    cancel();
    cancel = tween({ from: cur, to: on ? 100 : 40, duration: 380, onUpdate: v => { cur = v; num.textContent = Math.round(v); } });
  });

  // Contador de viajeros al entrar en pantalla
  const tile = $('#countTile'), out = $('#travelerCount');
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    tween({ from: 0, to: 12480, duration: 1400, onUpdate: v => { out.textContent = fmt(v); } });
  }, { threshold: 0.5 }).observe(tile);
}
