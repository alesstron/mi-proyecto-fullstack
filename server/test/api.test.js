/* =========================================================
   Pruebas de integración de la API contra una base de datos real.
   Requiere DATABASE_URL apuntando a una BD migrada y con seed
   (p. ej. docker compose up db && npm run db:migrate && npm run db:seed).
   Se omiten automáticamente si no hay DATABASE_URL.
   ========================================================= */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

const hasDb = Boolean(process.env.DATABASE_URL);
const ADMIN = 'test-admin-key-0123456789abcdef0123456789';

let server, base, prisma;
const unique = Date.now().toString(36);

async function req(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, data };
}

function futureDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('API Rumbo Nómada', { skip: !hasDb && 'DATABASE_URL no definida' }, () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.APP_URL = 'http://localhost:3999';
    process.env.ADMIN_API_KEY = ADMIN;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
    const { createApp } = await import('../src/app.js');
    ({ prisma } = await import('../src/lib/prisma.js'));
    server = createApp().listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise(r => server.close(r));
    await prisma.$disconnect();
  });

  /* ---------- Catálogo ---------- */
  test('health responde ok con la BD arriba', async () => {
    const r = await req('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.data.db, 'up');
  });

  test('destinos: filtro por categoría incluye etiquetas secundarias', async () => {
    const r = await req('/api/destinations?category=aventura');
    assert.equal(r.status, 200);
    const slugs = r.data.data.map(d => d.slug);
    assert.ok(slugs.includes('machu-picchu') && slugs.includes('bali'));
    assert.ok(!slugs.includes('tokio'));
    assert.ok(r.data.data.every(d => d.categories.includes('aventura')));
  });

  test('destinos: paginación y búsqueda sin acentos', async () => {
    const page = await req('/api/destinations?limit=2&page=2&sort=price_asc');
    assert.equal(page.data.data.length, 2);
    assert.equal(page.data.pagination.page, 2);
    assert.ok(page.data.pagination.total >= 6);
    const s = await req('/api/destinations?search=cancun');
    assert.equal(s.data.data[0].slug, 'cancun');
  });

  test('destinos: filtro maxDays según duración de paquetes', async () => {
    const r = await req('/api/destinations?maxDays=9');
    assert.deepEqual(r.data.data.map(d => d.slug).sort(), ['cancun', 'machu-picchu']);
  });

  test('destino por slug con paquetes y reseñas; 404 si no existe', async () => {
    const ok = await req('/api/destinations/tokio');
    assert.equal(ok.status, 200);
    assert.equal(ok.data.data.packages[0].slug, 'tokio-de-noche-y-de-dia');
    assert.ok(ok.data.data.cover.srcset.includes('800w'));
    const ko = await req('/api/destinations/atlantida');
    assert.equal(ko.status, 404);
    assert.equal(ko.data.error.code, 'NOT_FOUND');
  });

  test('validación: 400 con detalle por campo en español', async () => {
    const r = await req('/api/destinations?category=selva');
    assert.equal(r.status, 400);
    assert.equal(r.data.error.code, 'VALIDATION_ERROR');
    assert.equal(r.data.error.details[0].field, 'category');
  });

  test('endpoint inexistente → 404 JSON', async () => {
    const r = await req('/api/nada');
    assert.equal(r.status, 404);
    assert.ok(r.data.error.requestId);
  });

  /* ---------- Cotizador ---------- */
  test('cotización con destino usa su vuelo estimado y rechaza campos extra', async () => {
    const r = await req('/api/quotes/calculate', { method: 'POST', body: { budgetPerNight: 120, nights: 7, travelers: 2, includeFlights: true, destinationSlug: 'tokio' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.data.breakdown.find(b => b.key === 'flights').amount, 2500);
    assert.equal(r.data.data.fees.amount, 0);
    const bad = await req('/api/quotes/calculate', { method: 'POST', body: { budgetPerNight: 120, nights: 7, travelers: 2, total: 1 } });
    assert.equal(bad.status, 400);
    const json = await req('/api/quotes/calculate', { method: 'POST', body: '{roto' });
    assert.equal(json.data.error.code, 'INVALID_JSON');
  });

  /* ---------- Reservas ---------- */
  test('reserva: precio calculado en servidor, saneado XSS y control de plazas', async () => {
    const startDate = futureDate(60 + Math.floor(Math.random() * 300));
    const before = await req(`/api/packages/cicladas-en-velero/availability?startDate=${startDate}`);
    assert.equal(before.data.data.seatsLeft, 8);

    const ok = await req('/api/bookings', { method: 'POST', body: {
      name: 'Ana <img src=x onerror=alert(1)>López', email: `  Ana.${unique}@Example.com `, phone: '',
      packageSlug: 'cicladas-en-velero', startDate, travelers: 6, notes: '<script>x</script>Sin gluten'
    } });
    assert.equal(ok.status, 201);
    const b = ok.data.data.booking;
    assert.match(b.reference, /^RN-[A-Z2-9]{6}$/);
    assert.equal(b.totals.subtotal, 2450 * 6);
    assert.equal(b.endDate > b.startDate, true);

    const row = await prisma.booking.findUnique({ where: { reference: b.reference } });
    assert.equal(row.userName, 'Ana López');
    assert.equal(row.userEmail, `ana.${unique}@example.com`);
    assert.equal(row.notes, 'xSin gluten');
    assert.equal(row.userPhone, null);

    const after = await req(`/api/packages/cicladas-en-velero/availability?startDate=${startDate}`);
    assert.equal(after.data.data.seatsLeft, 2);

    const full = await req('/api/bookings', { method: 'POST', body: { name: 'Luis', email: 'luis@example.com', packageSlug: 'cicladas-en-velero', startDate, travelers: 3 } });
    assert.equal(full.status, 409);
    assert.equal(full.data.error.code, 'NO_AVAILABILITY');
  });

  test('reserva: fecha pasada, honeypot y pago sin Stripe', async () => {
    const past = await req('/api/bookings', { method: 'POST', body: { name: 'Luis', email: 'luis@example.com', packageSlug: 'bali-lento', startDate: '2020-01-01', travelers: 1 } });
    assert.equal(past.status, 400);
    const bot = await req('/api/bookings', { method: 'POST', body: { name: 'Bot', email: 'b@b.co', packageSlug: 'bali-lento', startDate: futureDate(40), travelers: 1, website: 'x' } });
    assert.equal(bot.status, 400);
    const pay = await req('/api/bookings', { method: 'POST', body: { name: 'Luis', email: 'luis@example.com', packageSlug: 'bali-lento', startDate: futureDate(40), travelers: 1, payDeposit: true } });
    assert.equal(pay.status, 503);
  });

  /* ---------- Newsletter ---------- */
  test('newsletter: alta, duplicado 409, baja por token y reactivación', async () => {
    const email = `news.${unique}@example.com`;
    const a = await req('/api/newsletter/subscribe', { method: 'POST', body: { email } });
    assert.equal(a.status, 201);
    const dup = await req('/api/newsletter/subscribe', { method: 'POST', body: { email: email.toUpperCase() } });
    assert.equal(dup.status, 409);

    const sub = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    const out = await req(`/api/newsletter/unsubscribe?token=${sub.unsubscribeToken}`);
    assert.equal(out.status, 303);
    assert.equal(out.headers.get('location'), '/?baja=ok');

    const again = await req('/api/newsletter/subscribe', { method: 'POST', body: { email } });
    assert.equal(again.status, 201);
    assert.equal(again.data.data.resubscribed, true);
  });

  /* ---------- Reseñas y administración ---------- */
  test('reseñas: moderación previa, admin con clave y rate limit', async () => {
    const created = await req('/api/reviews', { method: 'POST', body: {
      authorName: `Marta ${unique}`, authorLocation: 'Lima', rating: 5, destinationSlug: 'bali',
      comment: '<b>Increíble</b> viaje, Wayan nos llevó a arrozales que no salen en ninguna guía.'
    } });
    assert.equal(created.status, 202);
    const id = created.data.data.id;

    let list = await req('/api/reviews?limit=50');
    assert.ok(!list.data.data.some(r => r.id === id), 'una reseña pendiente no se publica');

    const noKey = await req(`/api/admin/reviews/${id}`, { method: 'PATCH', body: { status: 'approved' } });
    assert.equal(noKey.status, 401);
    const badKey = await req(`/api/admin/reviews/${id}`, { method: 'PATCH', body: { status: 'approved' }, headers: { Authorization: 'Bearer nope' } });
    assert.equal(badKey.status, 401);
    const ok = await req(`/api/admin/reviews/${id}`, { method: 'PATCH', body: { status: 'approved' }, headers: { Authorization: `Bearer ${ADMIN}` } });
    assert.equal(ok.status, 200);
    assert.ok(!ok.data.data.comment.includes('<b>'));

    list = await req('/api/reviews?limit=50');
    assert.ok(list.data.data.some(r => r.id === id));

    const codes = [];
    for (let i = 0; i < 3; i++) {
      codes.push((await req('/api/reviews', { method: 'POST', body: { authorName: 'Spam', rating: 1, comment: 'x'.repeat(30) } })).status);
    }
    assert.equal(codes.at(-1), 429);
  });

  /* ---------- Seguridad y SEO ---------- */
  test('cabeceras de seguridad y CORS restringido', async () => {
    const r = await req('/api/destinations', { headers: { Origin: 'https://malicioso.example' } });
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    const ok = await req('/api/destinations', { headers: { Origin: 'http://localhost:3999' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3999');
  });

  test('SSR: JSON-LD, datos iniciales y meta por destino', async () => {
    const home = await req('/');
    assert.equal(home.status, 200);
    assert.match(home.data, /"@type":"TravelAgency"/);
    assert.match(home.data, /"@type":"TouristTrip"/);
    assert.match(home.data, /id="bootstrap-data"/);

    const tokio = await req('/destinos/tokio');
    assert.match(tokio.data, /<link rel="canonical" href="http:\/\/localhost:3999\/destinos\/tokio">/);
    assert.match(tokio.data, /"openPackage":"tokio-de-noche-y-de-dia"/);

    const missing = await req('/destinos/atlantida', { headers: { Accept: 'text/html' } });
    assert.equal(missing.status, 404);
    assert.match(missing.data, /noindex/);

    const map = await req('/sitemap.xml');
    assert.match(map.data, /\/destinos\/patagonia/);
  });
});
