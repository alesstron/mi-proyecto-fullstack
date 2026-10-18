/* =========================================================
   Cotizador en tiempo real.
   1. Cálculo instantáneo en el navegador con el motor compartido.
   2. Verificación en el servidor (debounce + AbortController):
      el servidor es la fuente de verdad y su respuesta reajusta
      los números si hiciera falta.
   Los importes se animan con un contador que "frena" al llegar.
   ========================================================= */
import { $, EASE, clamp, esc, fmt, money, motion, emit, scrollToEl, debounce, tween } from '../core/dom.js';
import { api } from '../core/api.js';
import { store, destinationBySlug, packageForDestination } from '../core/store.js';
import { quote, PRICING } from '../../shared/pricing.js';

export function initQuote() {
  const budget = $('#budget'), nights = $('#nights'), flights = $('#flights'), destSel = $('#qDest');
  const meta = $('#quoteMeta'), metaText = $('#quoteMetaText');
  let pax = 2, dest = null, verifyCtrl = null, cancelBudget = () => {};

  destSel.insertAdjacentHTML('beforeend', store.destinations.map(d => `<option value="${esc(d.slug)}">${esc(d.title)} · ${esc(d.country)}</option>`).join(''));

  /* ---------- Contador animado ---------- */
  const shown = { total: 0, per: 0, lodging: 0, exp: 0, fl: 0, tax: 0 };
  const targets = { ...shown };
  let raf = null, tStart = 0, from = {};
  const out = { total: $('#total'), per: $('#perPerson'), lodging: $('#bLodging'), exp: $('#bExp'), fl: $('#bFlights'), tax: $('#bTax') };

  function render() {
    out.total.textContent = fmt(shown.total);
    for (const k of ['per', 'lodging', 'exp', 'fl', 'tax']) out[k].textContent = money(shown[k]);
  }
  function tick(now) {
    const t = clamp((now - tStart) / 420, 0, 1);
    const k = 1 - Math.pow(1 - t, 4);
    for (const key in targets) shown[key] = from[key] + (targets[key] - from[key]) * k;
    render();
    raf = t < 1 ? requestAnimationFrame(tick) : null;
  }
  function animateTo(q) {
    Object.assign(targets, { total: q.total, per: q.perPerson, lodging: q.lodging, exp: q.experiences, fl: q.flights, tax: q.taxes });
    if (motion.reduced) { Object.assign(shown, targets); render(); return; }
    from = { ...shown };
    tStart = performance.now();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const fill = r => r.style.setProperty('--fill', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
  const input = () => ({
    budgetPerNight: +budget.value,
    nights: +nights.value,
    travelers: pax,
    includeFlights: flights.getAttribute('aria-checked') === 'true',
    ...(dest && { destinationSlug: dest.slug })
  });

  function setMeta(state, text) {
    meta.dataset.state = state;
    metaText.textContent = text;
  }

  /* ---------- Verificación en servidor ---------- */
  const verify = debounce(async () => {
    if (store.source === 'fallback') return setMeta('local', 'Estimado calculado en tu navegador');
    verifyCtrl?.abort();
    verifyCtrl = new AbortController();
    setMeta('pending', 'Verificando con nuestro sistema…');
    try {
      const { data } = await api('/api/quotes/calculate', { method: 'POST', body: input(), signal: verifyCtrl.signal });
      const b = Object.fromEntries(data.breakdown.map(x => [x.key, x.amount]));
      animateTo({ total: data.total, perPerson: data.perPerson, lodging: b.lodging, experiences: b.experiences, flights: b.flights, taxes: data.taxes.amount });
      const until = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(data.validUntil));
      setMeta('ok', `Precio verificado · válido hasta el ${until}`);
    } catch (err) {
      if (err.name === 'AbortError' || verifyCtrl.signal.aborted) return;
      setMeta('local', err.status === 429 ? 'Estimado local (demasiadas consultas seguidas)' : 'Estimado calculado en tu navegador');
    }
  }, 380);

  function calc({ silent } = {}) {
    const i = input();
    $('#budgetVal').textContent = '$' + i.budgetPerNight;
    $('#nightsVal').textContent = i.nights + (i.nights === 1 ? ' noche' : ' noches');
    fill(budget); fill(nights);
    animateTo(quote({ ...i, flightEstimate: dest?.flightEstimate ?? PRICING.defaultFlight }));
    if (!silent) verify();
  }
  const announce = () => {
    $('#quoteStatus').textContent = `Estimado total: ${fmt(targets.total)} dólares para ${pax} ${pax === 1 ? 'viajero' : 'viajeros'}.`;
  };

  budget.addEventListener('input', () => { cancelBudget(); calc(); });
  nights.addEventListener('input', () => calc());
  budget.addEventListener('change', announce);
  nights.addEventListener('change', announce);
  flights.addEventListener('click', () => {
    flights.setAttribute('aria-checked', String(flights.getAttribute('aria-checked') !== 'true'));
    calc(); announce();
  });

  // Al elegir destino, el slider de presupuesto "viaja" hasta su precio medio por noche
  destSel.addEventListener('change', () => {
    dest = destSel.value ? destinationBySlug(destSel.value) : null;
    $('#flightHint').textContent = dest
      ? `Vuelo medio a ${dest.title}: ${money(dest.flightEstimate)} por persona.`
      : 'Estimado medio de ida y vuelta por persona.';
    $('#qDestHint').textContent = dest ? `Desde ${money(dest.pricePerNight)} por noche` : 'Ajusta el presupuesto y el vuelo';
    if (!dest) { calc(); return; }
    const target = clamp(Math.round(dest.pricePerNight / 10) * 10, +budget.min, +budget.max);
    cancelBudget();
    cancelBudget = tween({
      from: +budget.value, to: target, duration: 450,
      onUpdate: v => { budget.value = Math.round(v / 10) * 10; calc({ silent: true }); },
      onDone: () => { calc(); announce(); }
    });
  });

  function setPax(n) {
    const prev = pax;
    pax = clamp(n, 1, 8);
    const val = $('#paxVal');
    val.textContent = pax;
    $('#paxMinus').disabled = pax <= 1;
    $('#paxPlus').disabled = pax >= 8;
    if (prev !== pax && !motion.reduced) {
      const dir = pax > prev ? 1 : -1;
      val.animate([{ transform: `translateY(${dir * 70}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 240, easing: EASE });
    }
    calc(); announce();
  }
  $('#paxMinus').addEventListener('click', () => setPax(pax - 1));
  $('#paxPlus').addEventListener('click', () => setPax(pax + 1));

  // "Pedir propuesta": lleva el presupuesto al formulario de reserva
  $('#quoteCta').addEventListener('click', e => {
    e.preventDefault();
    const i = input();
    emit('rn:prefill', {
      packageSlug: dest ? packageForDestination(dest.slug)?.slug : undefined,
      travelers: pax,
      notes: `Presupuesto aproximado: $${i.budgetPerNight} por noche y persona, ${i.nights} noches${i.includeFlights ? ', con vuelos' : ''}. Estimado: ${money(targets.total)}.`
    });
    scrollToEl($('#reserva'));
    setTimeout(() => $('#bName').focus({ preventScroll: true }), motion.reduced ? 0 : 400);
  });

  setPax(2);
}
