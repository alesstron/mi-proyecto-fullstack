/* =========================================================
   Plantillas de correo. HTML con estilos en línea (lo único
   que respetan todos los clientes) + versión de texto plano.
   Todo valor dinámico pasa por escapeHtml.
   ========================================================= */
import { env } from '../config/env.js';
import { escapeHtml as e } from '../lib/sanitize.js';

const money = (n, cur = 'USD') => new Intl.NumberFormat('es-MX', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n));
const date = d => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);

function layout({ preheader, body }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FFF7F0;font-family:Helvetica,Arial,sans-serif;color:#1B2A3A">
<span style="display:none;max-height:0;overflow:hidden">${e(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(27,42,58,.08)">
<tr><td style="padding:28px 32px;background:#102030;color:#FBEFE4;font-size:20px;font-weight:800;letter-spacing:-.02em">Rumbo Nómada</td></tr>
<tr><td style="padding:32px;font-size:16px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:20px 32px;background:#FCEBDD;font-size:12px;color:#4B5869">Rumbo Nómada Viajes · Ciudad de México y Madrid · <a href="${e(env.APP_URL)}" style="color:#D81F5B">rumbonomada.com</a></td></tr>
</table></td></tr></table></body></html>`;
}

const row = (k, v) => `<tr><td style="padding:6px 0;color:#4B5869">${e(k)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${e(v)}</td></tr>`;

function bookingTable(b, pkg) {
  return `<table role="presentation" width="100%" style="margin:20px 0;border-top:1px solid #EBD9C8;border-bottom:1px solid #EBD9C8;padding:8px 0">
${row('Referencia', b.reference)}
${row('Paquete', pkg.title)}
${row('Salida', date(b.startDate))}
${row('Regreso', date(b.endDate))}
${row('Viajeros', String(b.travelersCount))}
${row('Subtotal', money(b.subtotal, b.currency))}
${row('Impuestos (IVA)', money(b.taxes, b.currency))}
${row('Total', money(b.totalPrice, b.currency))}
</table>`;
}

export function bookingReceivedEmail(b, pkg, { awaitingPayment }) {
  const first = b.userName.split(' ')[0];
  const next = awaitingPayment
    ? 'En cuanto se confirme el pago de la seña, tus plazas quedan bloqueadas y te enviamos la confirmación definitiva.'
    : 'Una persona del equipo revisa la disponibilidad con nuestros guías locales y te escribe en menos de 24 horas.';
  return {
    subject: `Hemos recibido tu solicitud ${b.reference} · ${pkg.title}`,
    html: layout({
      preheader: `Solicitud ${b.reference} recibida`,
      body: `<h1 style="font-size:26px;margin:0 0 12px">¡Gracias, ${e(first)}!</h1>
<p style="margin:0">Recibimos tu solicitud para <strong>${e(pkg.title)}</strong>. ${e(next)}</p>
${bookingTable(b, pkg)}
<p style="margin:0;color:#4B5869;font-size:14px">¿Algo que añadir? Responde a este correo y lo leemos nosotros, no un robot.</p>`
    }),
    text: `¡Gracias, ${first}! Recibimos tu solicitud ${b.reference} para ${pkg.title}.\n${next}\nSalida: ${date(b.startDate)} · Viajeros: ${b.travelersCount} · Total: ${money(b.totalPrice, b.currency)}`
  };
}

export function bookingConfirmedEmail(b, pkg) {
  const first = b.userName.split(' ')[0];
  return {
    subject: `Reserva confirmada ${b.reference} · ${pkg.title}`,
    html: layout({
      preheader: 'Tus plazas están bloqueadas',
      body: `<h1 style="font-size:26px;margin:0 0 12px">Todo listo, ${e(first)} ✈️</h1>
<p style="margin:0">Recibimos la seña de <strong>${e(money(b.depositAmount, b.currency))}</strong> y tus plazas en <strong>${e(pkg.title)}</strong> están confirmadas.</p>
${bookingTable(b, pkg)}
<p style="margin:0;color:#4B5869;font-size:14px">Tu guía local te escribirá dos semanas antes de la salida con los últimos detalles.</p>`
    }),
    text: `Todo listo, ${first}. Reserva ${b.reference} confirmada para ${pkg.title}. Seña recibida: ${money(b.depositAmount, b.currency)}.`
  };
}

export function newsletterWelcomeEmail(subscriber) {
  const unsubscribe = `${env.APP_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribeToken)}`;
  return {
    subject: 'Bienvenida a la carta de Rumbo Nómada',
    html: layout({
      preheader: 'Una carta al mes, sin relleno',
      body: `<h1 style="font-size:26px;margin:0 0 12px">Ya estás dentro 🧭</h1>
<p style="margin:0 0 16px">El primer lunes de cada mes te mandamos una ruta que aún no sale en Instagram, ofertas para suscriptores y nada de relleno.</p>
<p style="margin:0;font-size:13px;color:#4B5869">¿No era para ti? <a href="${e(unsubscribe)}" style="color:#D81F5B">Darte de baja</a> es un clic.</p>`
    }),
    text: `Ya estás dentro. Una carta al mes con rutas y ofertas.\nDarte de baja: ${unsubscribe}`
  };
}
