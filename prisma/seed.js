/* =========================================================
   Datos de ejemplo. Idempotente: se puede ejecutar en cada
   despliegue sin duplicar registros (upsert por slug).
   ========================================================= */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedCatalog } from '../server/src/services/seed.service.js';

const prisma = new PrismaClient();

seedCatalog(prisma)
  .then(r => console.log(`Seed listo: ${r.destinations} destinos, ${r.packages} paquetes.`))
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
