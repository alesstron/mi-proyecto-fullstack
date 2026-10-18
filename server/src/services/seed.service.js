/* =========================================================
   Datos iniciales (idempotente: upsert por slug). Lo usan el
   script prisma/seed.js y el endpoint GET /api/seed.
   ========================================================= */
import { DESTINATIONS, PACKAGES, REVIEWS } from '../../../public/shared/catalog.js';

export async function seedCatalog(prisma) {
  const idBySlug = {};

  for (const d of DESTINATIONS) {
    const data = {
      title: d.title, description: d.description, category: d.category, tags: d.tags,
      pricePerNight: d.pricePerNight, flightEstimate: d.flightEstimate, location: d.location,
      country: d.country, rating: d.rating, images: d.images, emoji: d.emoji,
      gradient: d.gradient, featured: d.featured
    };
    const row = await prisma.destination.upsert({ where: { slug: d.slug }, update: data, create: { slug: d.slug, ...data } });
    idBySlug[d.slug] = row.id;
  }

  for (const p of PACKAGES) {
    const data = {
      title: p.title, route: p.route, days: p.days, pricePerPerson: p.pricePerPerson,
      itinerary: p.itinerary, includes: p.includes, maxGroupSize: p.maxGroupSize,
      emoji: p.emoji, image: p.image, destinationId: idBySlug[p.destination]
    };
    await prisma.package.upsert({ where: { slug: p.slug }, update: data, create: { slug: p.slug, ...data } });
  }

  // Las reseñas no tienen clave natural: solo se insertan si la tabla está vacía
  let reviews = 0;
  if ((await prisma.review.count()) === 0) {
    const { count } = await prisma.review.createMany({
      data: REVIEWS.map((r, i) => ({
        authorName: r.authorName, authorLocation: r.authorLocation, rating: r.rating,
        comment: r.comment, status: 'approved', destinationId: idBySlug[r.destination],
        createdAt: new Date(Date.now() - (i + 1) * 9 * 864e5)
      }))
    });
    reviews = count;
  }

  return { destinations: DESTINATIONS.length, packages: PACKAGES.length, reviewsInserted: reviews };
}
