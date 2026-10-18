import * as bookings from '../services/booking.service.js';
import { calculateQuote } from '../services/quote.service.js';
import { constructWebhookEvent, paymentsEnabled } from '../lib/payments.js';
import { badRequest, serviceUnavailable } from '../lib/errors.js';
import { log } from '../lib/logger.js';
import { env } from '../config/env.js';

export async function quote(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ data: await calculateQuote(req.valid.body) });
}

export async function createBooking(req, res) {
  const { website, ...input } = req.valid.body;
  const result = await bookings.createBooking(input);
  res.status(201).json({ data: result });
}

export async function updateBookingStatus(req, res) {
  res.json({ data: await bookings.updateBookingStatus(req.valid.params.id, req.valid.body.status) });
}

/** Stripe firma cada evento; sin firma válida no se procesa nada. Necesita el body crudo. */
export async function stripeWebhook(req, res) {
  if (!paymentsEnabled() || !env.STRIPE_WEBHOOK_SECRET) throw serviceUnavailable('Pagos no configurados.');
  const signature = req.get('stripe-signature');
  if (!signature) throw badRequest('Falta la firma de Stripe.');

  let event;
  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    log.warn('Webhook de Stripe con firma inválida', { err: err.message });
    throw badRequest('Firma de webhook no válida.');
  }

  const result = await bookings.handleStripeEvent(event);
  res.json({ received: true, ...result });
}
