/* =========================================================
   Variables de entorno validadas al arrancar.
   Si falta algo obligatorio, el proceso termina con un mensaje
   claro en vez de fallar más tarde en mitad de una petición.
   ========================================================= */
import 'dotenv/config';
import { z } from 'zod';

const optional = schema => schema.optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000').transform(u => u.replace(/\/+$/, '')),
  CORS_ORIGINS: z.string().default('')
    .transform(s => s.split(',').map(o => o.trim().replace(/\/+$/, '')).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),

  DATABASE_URL: z.string({ required_error: 'DATABASE_URL es obligatoria' }).min(1),

  ADMIN_API_KEY: optional(z.string().min(32, 'ADMIN_API_KEY debe tener al menos 32 caracteres')),

  STRIPE_SECRET_KEY: optional(z.string().regex(/^(sk|rk)_/, 'STRIPE_SECRET_KEY debe empezar por sk_ o rk_')),
  STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_')),

  RESEND_API_KEY: optional(z.string().startsWith('re_')),
  MAIL_FROM: z.string().default('Rumbo Nómada <hola@rumbonomada.com>'),
  MAIL_REPLY_TO: optional(z.string().email()),

  CLOUDINARY_CLOUD_NAME: optional(z.string().regex(/^[a-z0-9_-]+$/i)),
  CLOUDINARY_API_KEY: optional(z.string()),
  CLOUDINARY_API_SECRET: optional(z.string())
});

// Una variable vacía en .env (STRIPE_SECRET_KEY=) se trata como no definida
const raw = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? undefined : v])
);

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('\n✖ Configuración inválida en las variables de entorno:\n');
  for (const issue of parsed.error.issues) console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  console.error('\nRevisa tu archivo .env (usa .env.example como plantilla).\n');
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test'
});
