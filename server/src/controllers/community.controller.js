import * as community from '../services/community.service.js';
import { signUpload, uploadsEnabled } from '../lib/images.js';
import { serviceUnavailable } from '../lib/errors.js';

export async function subscribe(req, res) {
  const { website, ...input } = req.valid.body;
  const data = await community.subscribe(input);
  res.status(201).json({ data, message: 'Suscripción confirmada. Te enviamos un correo de bienvenida.' });
}

/** Enlace de baja de los correos: redirige a la web con un aviso. */
export async function unsubscribe(req, res) {
  const { unsubscribed } = await community.unsubscribe(req.valid.query.token);
  res.redirect(303, unsubscribed ? '/?baja=ok' : '/?baja=ya');
}

export async function listReviews(req, res) {
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.json(await community.listReviews(req.valid.query));
}

export async function createReview(req, res) {
  const { website, ...input } = req.valid.body;
  const data = await community.createReview(input);
  res.status(202).json({ data, message: '¡Gracias! Publicaremos tu opinión cuando la revisemos.' });
}

export async function moderateReview(req, res) {
  res.json({ data: await community.moderateReview(req.valid.params.id, req.valid.body.status) });
}

export async function uploadSignature(req, res) {
  if (!uploadsEnabled()) throw serviceUnavailable('Cloudinary no está configurado.');
  res.set('Cache-Control', 'no-store');
  res.json({ data: signUpload(req.valid.body) });
}
