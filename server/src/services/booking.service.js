/* =========================================================
   Reservas: disponibilidad, precio, persistencia, pago y correo.
   ========================================================= */
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound, serviceUnavailable } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { queueMail } from '../lib/mailer.js';
import { paymentsEnabled, createDepositCheckout } from '../lib/payments.js';
import { serializeBooking } from '../lib/serializers.js';
import { bookingReceivedEmail, bookingConfirmedEmail } from '../emails/templates.js';
import { bookingTotal } from '../../../public/shared/pricing.js';
import { parseISODate, addDays } from '../../../public/shared/constraints.js';
import { seatsTaken } from './catalog.service.js';

const MAX_ATTEMPTS = 3;
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I

function newReference() {
  const bytes = crypto.randomBytes(6);
  return 'RN-' + [...bytes].map(b => REF_ALPHABET[b % REF_ALPHABET.length]).join('');
}

export async function createBooking(input) {
  const pkg = await prisma.package.findFirst({
    where: { slug: input.packageSlug, active: true },
    include: { destination: { select: { id: true, title: true } } }
  });
  if (!pkg) throw notFound('Ese paquete no existe o ya no está disponible.');

  if (input.payDeposit && !paymentsEnabled()) {
    throw serviceUnavailable('El pago en línea no está disponible ahora. Envía la solicitud sin pago y te contactamos.');
  }

  const startDate = parseISODate(input.startDate);
  const endDate = parseISODate(addDays(input.startDate, pkg.days - 1));
  const price = bookingTotal({ pricePerPerson: Number(pkg.pricePerPerson), travelers: input.travelers });

  // Transacción serializable: dos reservas simultáneas no pueden sobrevender la misma salida
  let booking;
  for (let attempt = 1; ; attempt++) {
    try {
      booking = await prisma.$transaction(async tx => {
        const left = pkg.maxGroupSize - (await seatsTaken(tx, pkg.id, startDate));
        if (input.travelers > left) {
          throw new AppError(409, 'NO_AVAILABILITY',
            left > 0 ? `Solo quedan ${left} plazas para esa salida.` : 'Esa salida está completa. Prueba con otra fecha.',
            [{ field: 'startDate', message: left > 0 ? `Quedan ${left} plazas en esta fecha.` : 'Salida completa.' }]);
        }
        return tx.booking.create({
          data: {
            reference: newReference(),
            userName: input.name,
            userEmail: input.email,
            userPhone: input.phone,
            destinationId: pkg.destinationId,
            packageId: pkg.id,
            startDate,
            endDate,
            travelersCount: input.travelers,
            unitPrice: price.unitPrice,
            subtotal: price.subtotal,
            taxes: price.taxes,
            totalPrice: price.total,
            depositAmount: price.deposit,
            currency: price.currency,
            notes: input.notes
          }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (err) {
      // P2034: conflicto de serialización · P2002: referencia duplicada (muy improbable)
      const retryable = err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2034' || err.code === 'P2002');
      if (!retryable || attempt >= MAX_ATTEMPTS) throw err;
    }
  }

  let checkoutUrl = null;
  if (input.payDeposit) {
    try {
      const session = await createDepositCheckout(booking, pkg);
      booking = await prisma.booking.update({ where: { id: booking.id }, data: { stripeSessionId: session.id } });
      checkoutUrl = session.url;
    } catch (err) {
      // La reserva queda guardada como pendiente aunque Stripe falle
      log.error('No se pudo crear la sesión de Stripe', { reference: booking.reference, err: err.message });
    }
  }

  const mail = bookingReceivedEmail(booking, pkg, { awaitingPayment: Boolean(checkoutUrl) });
  queueMail({ to: booking.userEmail, ...mail, idempotencyKey: `booking-received-${booking.id}` });

  return { booking: serializeBooking(booking, pkg), checkoutUrl, paymentError: input.payDeposit && !checkoutUrl };
}

/** Webhook de Stripe: confirma la reserva cuando el pago de la seña se completa. */
export async function handleStripeEvent(event) {
  const relevant = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  if (!relevant.includes(event.type)) return { handled: false };

  const session = event.data.object;
  if (session.payment_status !== 'paid') return { handled: false };
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return { handled: false };

  // updateMany con condición = idempotente: Stripe puede reenviar el mismo evento
  const { count } = await prisma.booking.updateMany({
    where: { id: bookingId, paymentStatus: 'unpaid' },
    data: { status: 'confirmed', paymentStatus: 'deposit_paid', stripeSessionId: session.id }
  });
  if (count === 0) return { handled: true, duplicate: true };

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { package: true } });
  queueMail({ to: booking.userEmail, ...bookingConfirmedEmail(booking, booking.package), idempotencyKey: `booking-confirmed-${booking.id}` });
  log.info('Reserva confirmada por pago', { reference: booking.reference });
  return { handled: true };
}

export async function updateBookingStatus(id, status) {
  const booking = await prisma.booking.update({ where: { id }, data: { status }, include: { package: true } });
  return serializeBooking(booking, booking.package);
}
