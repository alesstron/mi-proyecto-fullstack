/* =========================================================
   Pagos con Stripe Checkout (modo test / sandbox).
   El importe se calcula en el servidor y viaja en céntimos;
   la confirmación real llega por webhook firmado, nunca por
   la URL de retorno (que cualquiera podría visitar).
   ========================================================= */
import Stripe from 'stripe';
import { env } from '../config/env.js';

export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 10_000 }) : null;
export const paymentsEnabled = () => Boolean(stripe);

const fmtDate = d => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);

export async function createDepositCheckout(booking, pkg) {
  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      locale: 'es',
      customer_email: booking.userEmail,
      client_reference_id: booking.id,
      metadata: { bookingId: booking.id, reference: booking.reference },
      payment_intent_data: { metadata: { bookingId: booking.id, reference: booking.reference } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: booking.currency.toLowerCase(),
          unit_amount: Math.round(Number(booking.depositAmount) * 100),
          product_data: {
            name: `Seña de reserva · ${pkg.title}`,
            description: `Reserva ${booking.reference} · ${booking.travelersCount} viajero(s) · salida el ${fmtDate(booking.startDate)}`
          }
        }
      }],
      success_url: `${env.APP_URL}/?reserva=ok&ref=${encodeURIComponent(booking.reference)}`,
      cancel_url: `${env.APP_URL}/?reserva=cancelada&ref=${encodeURIComponent(booking.reference)}#reserva`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60
    },
    { idempotencyKey: `deposit-${booking.id}` }
  );
}

export function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
