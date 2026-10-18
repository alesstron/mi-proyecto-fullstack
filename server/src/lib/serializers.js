/* =========================================================
   Serializadores: definen exactamente qué sale por la API.
   Decimal → number, fechas → ISO, nada de campos internos.
   ========================================================= */
import { imageSet } from './images.js';
import { toISODate } from '../../../public/shared/constraints.js';

const num = v => (v == null ? null : Number(v));

export function serializePackage(p, destination = p.destination) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    route: p.route,
    days: p.days,
    nights: p.days - 1,
    pricePerPerson: num(p.pricePerPerson),
    itinerary: p.itinerary,
    includes: p.includes,
    maxGroupSize: p.maxGroupSize,
    emoji: p.emoji,
    destination: destination
      ? { slug: destination.slug, title: destination.title, country: destination.country, gradient: destination.gradient, emoji: destination.emoji }
      : undefined
  };
}

export function serializeDestination(d) {
  const packages = (d.packages ?? []).map(p => serializePackage(p, d));
  const cheapest = packages.reduce((a, b) => (!a || b.pricePerPerson < a.pricePerPerson ? b : a), null);
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    description: d.description,
    category: d.category,
    categories: [d.category, ...d.tags.filter(t => t !== d.category)],
    location: d.location,
    country: d.country,
    pricePerNight: num(d.pricePerNight),
    flightEstimate: num(d.flightEstimate),
    rating: num(d.rating),
    images: d.images,
    cover: imageSet(d.images[0]),
    emoji: d.emoji,
    gradient: d.gradient,
    featured: d.featured,
    fromPrice: cheapest?.pricePerPerson ?? null,
    days: cheapest?.days ?? null,
    packages: packages.map(({ destination, ...p }) => p),
    updatedAt: d.updatedAt?.toISOString()
  };
}

export function serializeReview(r) {
  return {
    id: r.id,
    authorName: r.authorName,
    authorLocation: r.authorLocation,
    avatarUrl: r.avatarUrl,
    rating: r.rating,
    comment: r.comment,
    destination: r.destination ? { slug: r.destination.slug, title: r.destination.title } : null,
    createdAt: r.createdAt.toISOString()
  };
}

/** Vista pública de una reserva: sin ids internos ni datos de pago sensibles. */
export function serializeBooking(b, pkg) {
  return {
    reference: b.reference,
    status: b.status,
    paymentStatus: b.paymentStatus,
    package: { slug: pkg.slug, title: pkg.title },
    startDate: toISODate(b.startDate),
    endDate: toISODate(b.endDate),
    travelers: b.travelersCount,
    totals: {
      currency: b.currency,
      unitPrice: num(b.unitPrice),
      subtotal: num(b.subtotal),
      taxes: num(b.taxes),
      total: num(b.totalPrice),
      deposit: num(b.depositAmount)
    },
    createdAt: b.createdAt.toISOString()
  };
}
