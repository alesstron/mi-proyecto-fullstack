import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { log } from './lib/logger.js';
import { paymentsEnabled } from './lib/payments.js';
import { mailEnabled } from './lib/mailer.js';
import { uploadsEnabled } from './lib/images.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  log.info(`Rumbo Nómada listo en ${env.APP_URL} (puerto ${env.PORT}, ${env.NODE_ENV})`);
  log.info('Integraciones', {
    stripe: paymentsEnabled() ? 'activo' : 'desactivado',
    resend: mailEnabled() ? 'activo' : 'simulado en consola',
    cloudinary: uploadsEnabled() ? 'activo' : 'desactivado',
    admin: env.ADMIN_API_KEY ? 'activo' : 'desactivado'
  });
  if (env.isProd && paymentsEnabled() && !env.STRIPE_WEBHOOK_SECRET) {
    log.warn('STRIPE_WEBHOOK_SECRET no está definido: las reservas pagadas no se confirmarán solas.');
  }
});

// Detrás de un balanceador, el keep-alive del servidor debe superar al del proxy
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  log.info(`${signal} recibido: cerrando conexiones…`);
  const force = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await prisma.$disconnect();
    clearTimeout(force);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', reason => log.error('Promesa rechazada sin manejar', { reason: String(reason) }));
