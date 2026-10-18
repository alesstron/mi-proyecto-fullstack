/* Newsletter y reseñas. */
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { queueMail } from '../lib/mailer.js';
import { serializeReview } from '../lib/serializers.js';
import { newsletterWelcomeEmail } from '../emails/templates.js';

/* ---------- Newsletter ---------- */
const ALREADY = 'Ese correo ya está suscrito. ¡Gracias por seguir con nosotros!';

export async function subscribe({ email, source }) {
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.status === 'active') throw conflict(ALREADY);

  let subscriber;
  try {
    subscriber = existing
      ? await prisma.newsletterSubscriber.update({
          where: { id: existing.id },
          data: { status: 'active', source, subscribedAt: new Date(), unsubscribedAt: null, unsubscribeToken: crypto.randomUUID() }
        })
      : await prisma.newsletterSubscriber.create({ data: { email, source } });
  } catch (err) {
    // Dos envíos simultáneos del mismo correo: el índice único decide
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict(ALREADY);
    throw err;
  }

  queueMail({ to: subscriber.email, ...newsletterWelcomeEmail(subscriber), idempotencyKey: `welcome-${subscriber.id}-${subscriber.unsubscribeToken}` });
  return { email: subscriber.email, status: subscriber.status, resubscribed: Boolean(existing) };
}

export async function unsubscribe(token) {
  const { count } = await prisma.newsletterSubscriber.updateMany({
    where: { unsubscribeToken: token, status: 'active' },
    data: { status: 'unsubscribed', unsubscribedAt: new Date() }
  });
  return { unsubscribed: count > 0 };
}

/* ---------- Reseñas ---------- */
export async function listReviews({ destination, page, limit }) {
  const where = { status: 'approved', ...(destination && { destination: { slug: destination } }) };
  const [rows, total, stats] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      include: { destination: { select: { slug: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } })
  ]);
  return {
    data: rows.map(serializeReview),
    summary: { average: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null, count: total },
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

/** Las reseñas nuevas entran en moderación; solo las aprobadas se publican. */
export async function createReview({ authorName, authorLocation, rating, comment, destinationSlug }) {
  let destinationId = null;
  if (destinationSlug) {
    const d = await prisma.destination.findUnique({ where: { slug: destinationSlug }, select: { id: true } });
    if (!d) throw notFound('No encontramos ese destino.');
    destinationId = d.id;
  }
  const review = await prisma.review.create({
    data: { authorName, authorLocation, rating, comment, destinationId }
  });
  return { id: review.id, status: review.status };
}

export async function moderateReview(id, status) {
  const review = await prisma.review.update({
    where: { id },
    data: { status },
    include: { destination: { select: { slug: true, title: true } } }
  });
  return { ...serializeReview(review), status: review.status };
}
