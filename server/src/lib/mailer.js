/* =========================================================
   Correos transaccionales con Resend (API REST, sin SDK).
   Sin RESEND_API_KEY, el correo se escribe en la consola para
   poder desarrollar sin cuenta. Un fallo de envío nunca rompe
   la petición que lo originó (se registra y se sigue).
   ========================================================= */
import { env } from '../config/env.js';
import { log } from './logger.js';

export const mailEnabled = () => Boolean(env.RESEND_API_KEY);

export async function sendMail({ to, subject, html, text, idempotencyKey }) {
  if (!mailEnabled()) {
    log.info('[correo simulado]', { to, subject });
    if (!env.isProd && !env.isTest) console.log(text);
    return { id: 'dev-preview', simulated: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey })
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      ...(env.MAIL_REPLY_TO && { reply_to: env.MAIL_REPLY_TO })
    }),
    signal: AbortSignal.timeout(8000)
  });

  if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Envío en segundo plano: la respuesta HTTP no espera al proveedor de correo. */
export function queueMail(message) {
  sendMail(message).catch(err => log.error('No se pudo enviar el correo', { to: message.to, subject: message.subject, err: err.message }));
}
