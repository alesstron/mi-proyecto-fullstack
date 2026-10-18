import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, bookingTotal, PRICING } from '../../public/shared/pricing.js';
import { addDays, parseISODate, EMAIL_RE, PHONE_RE } from '../../public/shared/constraints.js';

test('quote: desglose, IVA solo sobre servicios y precio por persona', () => {
  const q = quote({ budgetPerNight: 100, nights: 7, travelers: 2, includeFlights: true, flightEstimate: 500 });
  assert.equal(q.lodging, 1400);
  assert.equal(q.experiences, PRICING.experiencePerNight * 7 * 2);
  assert.equal(q.flights, 1000);
  assert.equal(q.taxes, Math.round((1400 + 532) * PRICING.taxRate * 100) / 100);
  assert.equal(q.total, q.subtotal + q.taxes);
  assert.equal(q.perPerson, q.total / 2);
});

test('quote: sin vuelos', () => {
  assert.equal(quote({ budgetPerNight: 80, nights: 3, travelers: 1, includeFlights: false }).flights, 0);
});

test('bookingTotal: seña del 20 % y redondeo a céntimos', () => {
  const b = bookingTotal({ pricePerPerson: 1290, travelers: 3 });
  assert.equal(b.subtotal, 3870);
  assert.equal(b.taxes, 619.2);
  assert.equal(b.total, 4489.2);
  assert.equal(b.deposit, 897.84);
});

test('fechas ISO: validación y suma de días entre meses y años', () => {
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(parseISODate('2026-02-30'), null);
  assert.equal(parseISODate('hola'), null);
  assert.ok(parseISODate('2028-02-29'));
});

test('reglas compartidas de email y teléfono', () => {
  assert.ok(EMAIL_RE.test('ana@rumbo.mx'));
  assert.ok(!EMAIL_RE.test('ana@rumbo'));
  assert.ok(PHONE_RE.test('+52 55 1234 5678'));
  assert.ok(!PHONE_RE.test('12ab'));
});
