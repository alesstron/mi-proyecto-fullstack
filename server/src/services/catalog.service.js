/* Destinos y paquetes: listados con filtros, detalle y disponibilidad. */
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { slugify } from '../lib/sanitize.js';
import { serializeDestination, serializePackage, serializeReview } from '../lib/serializers.js';
import { parseISODate } from '../../../public/shared/constraints.js';

const activePackages = { where: { active: true }, orderBy: { pricePerPerson: 'asc' } };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER = {
  featured: [{ featured: 'desc' }, { rating: 'desc' }, { title: 'asc' }],
  price_asc: [{ pricePerNight: 'asc' }],
  price_desc: [{ pricePerNight: 'desc' }],
  rating: [{ rating: 'desc' }, { title: 'asc' }]
};

export async function listDestinations({ category, featured, search, maxDays, sort, page, limit }) {
  const and = [];
  if (category) and.push({ OR: [{ category }, { tags: { has: category } }] });
  if (featured !== undefined) and.push({ featured });
  if (search) {
    // ILIKE no ignora acentos: buscamos también en el slug normalizado ("cancun" → Cancún)
    const term = search.trim();
    and.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { country: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { slug: { contains: slugify(term) || term } }
      ]
    });
  }
  if (maxDays) and.push({ packages: { some: { active: true, days: { lte: maxDays } } } });

  const where = and.length ? { AND: and } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.destination.findMany({
      where,
      include: { packages: activePackages },
      orderBy: ORDER[sort],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.destination.count({ where })
  ]);

  return {
    data: rows.map(serializeDestination),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function getDestination(idOrSlug) {
  const where = UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug.toLowerCase() };
  const d = await prisma.destination.findUnique({
    where,
    include: {
      packages: activePackages,
      reviews: { where: { status: 'approved' }, orderBy: { createdAt: 'desc' }, take: 6 }
    }
  });
  if (!d) throw notFound('No encontramos ese destino.');

  const stats = await prisma.review.aggregate({
    where: { destinationId: d.id, status: 'approved' },
    _avg: { rating: true },
    _count: true
  });

  return {
    ...serializeDestination(d),
    reviews: d.reviews.map(r => serializeReview({ ...r, destination: d })),
    reviewSummary: { average: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null, count: stats._count }
  };
}

export async function listPackages({ destination }) {
  const rows = await prisma.package.findMany({
    where: { active: true, ...(destination && { destination: { slug: destination } }) },
    include: { destination: true },
    orderBy: [{ destination: { featured: 'desc' } }, { pricePerPerson: 'asc' }]
  });
  return rows.map(p => serializePackage(p));
}

/** Plazas libres en una salida: grupo = mismo paquete + misma fecha de salida. */
export async function seatsTaken(client, packageId, startDate) {
  const agg = await client.booking.aggregate({
    where: { packageId, startDate, status: { not: 'cancelled' } },
    _sum: { travelersCount: true }
  });
  return agg._sum.travelersCount ?? 0;
}

export async function getAvailability(slug, startDateISO) {
  const pkg = await prisma.package.findFirst({ where: { slug, active: true }, select: { id: true, maxGroupSize: true } });
  if (!pkg) throw notFound('Ese paquete no existe o ya no está disponible.');
  const taken = await seatsTaken(prisma, pkg.id, parseISODate(startDateISO));
  const seatsLeft = Math.max(0, pkg.maxGroupSize - taken);
  return { packageSlug: slug, startDate: startDateISO, maxGroupSize: pkg.maxGroupSize, seatsLeft, available: seatsLeft > 0 };
}
