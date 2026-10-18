/* =========================================================
   Punto de entrada. Primero lo que no depende de datos (pinta
   al instante), después lo que se alimenta de la API.
   ========================================================= */
import { $ } from './core/dom.js';
import { loadInitialData, store, packageBySlug } from './core/store.js';
import { toast } from './ui/toast.js';
import { initTheme, initNav, initMagnetic, initReveal, initFooter } from './ui/chrome.js';
import { initHeroVisuals, initSearch } from './ui/hero.js';
import { initRoute } from './ui/route.js';
import { initBento } from './ui/bento.js';
import { initDrawer, openDrawer } from './ui/drawer.js';
import { initDestinations } from './ui/destinations.js';
import { initCarousel } from './ui/carousel.js';
import { initQuote } from './ui/quote.js';
import { initTestimonials } from './ui/testimonials.js';
import { initBooking } from './ui/booking.js';
import { initNewsletter } from './ui/newsletter.js';
import { initPwa } from './pwa.js';

/* ---------- Sin datos ---------- */
initTheme();
initNav();
initHeroVisuals();
initMagnetic();
initRoute();
initBento();
initFooter();
initReveal();
initDrawer();
initPwa();

/* ---------- Con datos ---------- */
await loadInitialData();

initDestinations();
initCarousel();
initQuote();
initTestimonials();
initBooking();
initNewsletter();
initSearch();

/* ---------- Avisos por URL (retorno de Stripe, baja del boletín) ---------- */
const params = new URLSearchParams(location.search);
const NOTICES = {
  'reserva=ok': () => ({ type: 'success', title: 'Pago recibido', desc: `Tu reserva ${params.get('ref') ?? ''} quedará confirmada en unos segundos. Te llegará un correo.`.replace('  ', ' '), duration: 9000 }),
  'reserva=cancelada': () => ({ type: 'info', title: 'Pago cancelado', desc: 'Tu solicitud sigue guardada como pendiente. Te escribiremos para cerrarla.' }),
  'baja=ok': () => ({ type: 'success', title: 'Baja confirmada', desc: 'No recibirás más cartas. Te echaremos de menos.' }),
  'baja=ya': () => ({ type: 'info', title: 'Ya estabas dado de baja', desc: 'Ese enlace ya se había usado.' })
};
for (const [key, build] of Object.entries(NOTICES)) {
  const [k, v] = key.split('=');
  if (params.get(k) === v) toast(build());
}
if (params.has('reserva') || params.has('baja')) {
  history.replaceState(history.state, '', location.pathname + location.hash);
}

if (store.source === 'fallback') {
  toast({ type: 'info', title: 'Modo demostración', desc: 'No hay conexión con el servidor: verás datos de ejemplo y los formularios no se enviarán.', duration: 7000 });
}
if (store.notFound) {
  toast({ type: 'error', title: 'Destino no encontrado', desc: 'Te mostramos todos nuestros destinos.' });
}
if (store.openPackage) {
  setTimeout(() => openDrawer(packageBySlug(store.openPackage), $('#destGrid')), 450);
}
