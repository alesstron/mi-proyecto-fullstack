/* =========================================================
   Formulario de reserva.
   - Resumen en vivo: fecha de regreso, total con IVA y seña.
   - Plazas de la salida consultadas a la API y dibujadas como
     asientos (los tuyos se iluminan en el color de acento).
   - Envío con toast que pasa de "procesando" a éxito/error.
   - Si hay Stripe, redirige al pago de la seña.
   ========================================================= */
import { $, esc, clamp, money, motion, EASE, on, setLoading, fmtLongDate, debounce } from '../core/dom.js';
import { api } from '../core/api.js';
import { store, packageBySlug } from '../core/store.js';
import { toast } from './toast.js';
import { createValidator, RULES } from './forms.js';
import { bookingTotal } from '../../shared/pricing.js';
import { LIMITS, addDays, localToday } from '../../shared/constraints.js';

export function initBooking() {
  const form = $('#bookingForm');
  const v = createValidator(form);
  const sel = $('#bPackage'), date = $('#bDate'), trav = $('#bTravelers'), notes = $('#bNotes');
  const summary = $('#bookingSummary'), seats = $('#seats');

  // Paquetes agrupados por destino
  const groups = new Map();
  store.packages.forEach(p => {
    const key = p.destination.title;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  });
  sel.insertAdjacentHTML('beforeend', [...groups].map(([dest, list]) =>
    `<optgroup label="${esc(dest)}">${list.map(p => `<option value="${esc(p.slug)}">${esc(p.title)} · ${p.days} días · ${money(p.pricePerPerson)}</option>`).join('')}</optgroup>`).join(''));

  date.min = addDays(localToday(), LIMITS.bookingLeadDays);
  date.max = addDays(localToday(), LIMITS.bookingHorizonDays);
  if (store.config.payments) $('#depositRow').hidden = false;

  /* ---------- Resumen y plazas ---------- */
  function setValue(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
    if (!motion.reduced) el.animate([{ transform: 'translateY(35%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: EASE });
  }

  function renderSeats(max, left, travelers) {
    const taken = max - left;
    const fits = travelers <= left;
    $('#seatDots').innerHTML = Array.from({ length: max }, (_, i) => {
      const cls = i < taken ? 'taken' : i < taken + travelers ? (fits ? 'mine' : 'over') : 'free';
      return `<span class="seat ${cls}" style="--i:${i}"></span>`;
    }).join('');
    seats.dataset.state = left === 0 ? 'full' : fits ? 'ok' : 'short';
    $('#seatText').textContent = left === 0
      ? 'Salida completa: elige otra fecha.'
      : fits ? `Quedan ${left} de ${max} plazas. Las tuyas, en rosa.` : `Solo quedan ${left} plazas: reduce viajeros o cambia de fecha.`;
    seats.hidden = false;
  }

  let availCtrl;
  const loadSeats = debounce(async (pkg, start, travelers) => {
    availCtrl?.abort();
    availCtrl = new AbortController();
    try {
      const { data } = await api(`/api/packages/${pkg.slug}/availability`, { query: { startDate: start }, signal: availCtrl.signal });
      renderSeats(data.maxGroupSize, data.seatsLeft, travelers);
    } catch (err) {
      if (err.name !== 'AbortError') seats.hidden = true;
    }
  }, 250);

  function updateSummary() {
    const pkg = packageBySlug(sel.value);
    const travelers = +trav.value;
    if (!pkg) { summary.hidden = true; return; }
    summary.hidden = false;
    const t = bookingTotal({ pricePerPerson: pkg.pricePerPerson, travelers });
    setValue($('#bsTotal'), money(t.total));
    setValue($('#bsDeposit'), money(t.deposit));
    const validDate = !RULES.date(date.value);
    setValue($('#bsReturn'), validDate ? `${fmtLongDate(addDays(date.value, pkg.days - 1))}` : `${pkg.days} días de viaje`);
    if (validDate && store.source !== 'fallback') loadSeats(pkg, date.value, travelers);
    else seats.hidden = true;
  }
  [sel, date, trav].forEach(el => el.addEventListener('change', updateSummary));

  /* ---------- Precarga desde drawer, buscador o cotizador ---------- */
  on('rn:prefill', d => {
    if (d.packageSlug && packageBySlug(d.packageSlug)) sel.value = d.packageSlug;
    if (d.startDate && !RULES.date(d.startDate)) date.value = d.startDate;
    if (d.travelers) trav.value = String(clamp(d.travelers, 1, 8));
    if (d.notes && !notes.value.trim()) notes.value = d.notes;
    [sel, date].forEach(el => { if (el.value) el.dispatchEvent(new Event('change')); });
    updateSummary();
    form.classList.remove('is-prefilled');
    void form.offsetWidth;
    form.classList.add('is-prefilled');
  });

  /* ---------- Envío ---------- */
  const copy = ref => navigator.clipboard?.writeText(ref).then(
    () => toast({ type: 'success', title: 'Referencia copiada', desc: ref, duration: 2500 }),
    () => {}
  );
  const isStripeUrl = url => { try { const u = new URL(url); return u.protocol === 'https:' && /(^|\.)stripe\.com$/.test(u.hostname); } catch { return false; } };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    // Los errores ya se ven en cada campo (mensaje + shake + foco): un toast aquí taparía el botón de envío
    const bad = v.validateAll();
    if (bad) { bad.focus(); return; }

    const f = name => form.elements.namedItem(name);
    const body = {
      name: f('name').value.trim(),
      email: f('email').value.trim(),
      phone: f('phone').value.trim(),
      packageSlug: sel.value,
      startDate: date.value,
      travelers: +trav.value,
      notes: notes.value.trim(),
      payDeposit: Boolean(store.config.payments && $('#bDeposit').checked),
      website: f('website').value
    };
    const firstName = body.name.split(/\s+/)[0];
    const btn = $('#bookingBtn');
    setLoading(btn, true, 'Enviando…');

    const request = api('/api/bookings', { method: 'POST', body, timeout: 20_000 });
    toast.promise(request, {
      loading: { title: 'Procesando tu reserva…', desc: 'Comprobamos las plazas de esa salida.' },
      success: ({ data }) => data.checkoutUrl
        ? { title: `Reserva ${data.booking.reference} creada`, desc: 'Te llevamos al pago seguro de la seña…', duration: 8000 }
        : {
            title: `Solicitud ${data.booking.reference} recibida`,
            desc: `Gracias, ${firstName}. Te enviamos el resumen a ${body.email}.`,
            duration: 9000,
            action: { label: 'Copiar referencia', onClick: () => copy(data.booking.reference) }
          },
      error: err => ({
        title: err.code === 'NO_AVAILABILITY' ? 'No quedan plazas suficientes'
          : err.code === 'VALIDATION_ERROR' ? 'Revisa los campos marcados'
          : err.status === 429 ? 'Demasiadas solicitudes' : 'No pudimos enviar la solicitud',
        desc: err.message
      })
    });

    try {
      const { data } = await request;
      v.reset();
      updateSummary();
      if (data.paymentError) {
        toast({ type: 'info', title: 'Pago no disponible ahora', desc: 'Tu solicitud quedó guardada. Te enviaremos un enlace de pago.' });
      }
      if (data.checkoutUrl && isStripeUrl(data.checkoutUrl)) {
        setTimeout(() => location.assign(data.checkoutUrl), motion.reduced ? 300 : 1200);
      }
    } catch (err) {
      v.showServerErrors(err.details)?.focus();
      if (err.code === 'NO_AVAILABILITY') updateSummary();
    } finally {
      setLoading(btn, false);
    }
  });
}
