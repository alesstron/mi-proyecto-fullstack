import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// En desarrollo, --watch reinicia el proceso; reutilizamos el cliente si existe
const globalRef = globalThis;

export const prisma = globalRef.__prisma ?? new PrismaClient({
  log: env.isProd ? ['error'] : ['warn', 'error']
});

if (!env.isProd) globalRef.__prisma = prisma;
