import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { quote, PRICING } from '../../../public/shared/pricing.js';

const VALIDITY_HOURS = 48;

export async function calculateQuote({ budgetPerNight, nights, travelers, includeFlights, destinationSlug }) {
  let destination = null;
  let flightEstimate = PRICING.defaultFlight;

  if (destinationSlug) {
    const d = await prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { slug: true, title: true, pricePerNight: true, flightEstimate: true }
    });
    if (!d) throw notFound('No encontramos ese destino.');
    flightEstimate = Number(d.flightEstimate);
    destination = { slug: d.slug, title: d.title, pricePerNight: Number(d.pricePerNight), flightEstimate };
  }

  const q = quote({ budgetPerNight, nights, travelers, includeFlights, flightEstimate });

  return {
    currency: q.currency,
    input: { budgetPerNight, nights, travelers, includeFlights, destinationSlug: destinationSlug ?? null },
    destination,
    breakdown: [
      { key: 'lodging', label: 'Alojamiento', amount: q.lodging },
      { key: 'experiences', label: 'Experiencias con guía local', amount: q.experiences },
      { key: 'flights', label: 'Vuelos', amount: q.flights }
    ],
    subtotal: q.subtotal,
    taxes: { label: 'Impuestos (IVA)', rate: q.taxRate, amount: q.taxes },
    fees: { label: 'Cargos de gestión', amount: 0 },
    total: q.total,
    perPerson: q.perPerson,
    validUntil: new Date(Date.now() + VALIDITY_HOURS * 3600_000).toISOString(),
    disclaimer: 'Estimado orientativo. El precio final se cierra en la propuesta y no cambia después.'
  };
}
