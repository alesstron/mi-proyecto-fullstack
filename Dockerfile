# syntax=docker/dockerfile:1

# ---------- Dependencias + cliente Prisma ----------
FROM node:22-alpine AS deps
WORKDIR /app
# openssl es necesario para los motores de Prisma en Alpine
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
    && npx prisma generate

# ---------- Imagen final ----------
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY server ./server
COPY public ./public

# Nunca ejecutar como root
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# tini reenvía SIGTERM para que el apagado ordenado funcione
ENTRYPOINT ["/sbin/tini", "--"]
# Aplica migraciones pendientes y arranca. El seed es idempotente y se lanza aparte.
CMD ["sh", "-c", "npx prisma migrate deploy && node server/src/index.js"]
