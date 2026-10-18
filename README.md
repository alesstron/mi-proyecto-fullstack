# Rumbo Nómada · plataforma web de la agencia de viajes

Front-end animado (HTML/CSS/JS nativo con módulos ES), API REST con Express 5, PostgreSQL con Prisma, pagos con Stripe, correos con Resend, imágenes con Cloudinary, SEO con renderizado en servidor y PWA.

```
Navegador ──► Express 5 ──┬─► /api/*            API REST (Zod, rate limit, errores centralizados)
                          ├─► /, /destinos/:slug HTML con meta/JSON-LD dinámicos + datos iniciales
                          ├─► /sitemap.xml, /robots.txt
                          └─► estáticos (public/)
                 │
                 ├─► PostgreSQL (Prisma)     destinos, paquetes, reservas, suscriptores, reseñas
                 ├─► Stripe Checkout         seña del 20 % + webhook firmado
                 ├─► Resend                  confirmación de reserva y bienvenida al boletín
                 └─► Cloudinary              f_auto/q_auto (AVIF/WebP) y subida firmada
```

---

## Estructura

```
rumbo-nomada/
├── public/                     Front-end (lo sirve Express o cualquier CDN)
│   ├── index.html              Marcado semántico + huecos para SEO y datos (SSR)
│   ├── css/styles.css          Tokens, componentes, modo oscuro, reduced-motion
│   ├── js/
│   │   ├── main.js             Arranque: primero lo visual, luego lo que usa datos
│   │   ├── core/               dom.js (utilidades), api.js (cliente HTTP), store.js (datos)
│   │   └── ui/                 Un módulo por sección (hero, destinos, drawer, cotizador…)
│   ├── shared/                 Código compartido navegador ↔ servidor
│   │   ├── constraints.js      Límites y regex de validación
│   │   ├── pricing.js          Motor de precios (cotizador y reservas)
│   │   └── catalog.js          Datos de ejemplo (seed y modo demostración)
│   ├── sw.js, manifest.webmanifest, offline.html, icons/
├── server/
│   ├── src/
│   │   ├── index.js            Arranque y apagado ordenado
│   │   ├── app.js              Orden de middlewares
│   │   ├── config/env.js       Variables de entorno validadas con Zod
│   │   ├── routes/api.js       Rutas
│   │   ├── controllers/        Capa HTTP fina
│   │   ├── services/           Lógica de negocio (reservas, catálogo, cotización…)
│   │   ├── schemas/            Validación Zod de cada endpoint
│   │   ├── middleware/         Seguridad, rate limit, validación, admin, errores
│   │   ├── lib/                Prisma, Stripe, Resend, Cloudinary, saneado, serializadores
│   │   ├── emails/templates.js Plantillas HTML + texto
│   │   └── seo/render.js       Meta dinámicas, JSON-LD, sitemap, robots
│   └── test/                   node:test (unitarios + integración contra BD real)
├── prisma/
│   ├── schema.prisma           Modelos
│   ├── migrations/             SQL de creación (incluye restricciones CHECK)
│   └── seed.js                 Datos de ejemplo (idempotente)
├── scripts/make-icons.py       Genera los PNG de la PWA sin dependencias
├── Dockerfile, docker-compose.yml, render.yaml, vercel.json
└── .env.example
```

---

## Ejecución local

**Requisitos:** Node.js ≥ 20.11 y un PostgreSQL 14+ (con Docker, instalado o una base gratuita en Neon/Supabase).

### Opción A · todo con Docker

```bash
cp .env.example .env
docker compose up --build
# → http://localhost:3000  (migraciones + seed se aplican solos)
```

### Opción B · Node en local + Postgres en Docker

```bash
cp .env.example .env              # DATABASE_URL ya apunta a localhost:5432
docker compose up -d db           # solo la base de datos
npm install                       # instala y genera el cliente Prisma
npm run db:migrate                # aplica prisma/migrations
npm run db:seed                   # 6 destinos, 6 paquetes, 5 reseñas
npm run dev                       # http://localhost:3000 con recarga automática
```

### Opción C · sin Docker

Cualquier PostgreSQL sirve. Para no instalar nada, `embedded-postgres` descarga un PostgreSQL real y portátil (inicialízalo con `--encoding=UTF8`: el catálogo usa emojis). O crea una base gratuita en [Neon](https://neon.tech) y pega su cadena en `DATABASE_URL`. Después:

```bash
cp .env.example .env
npm install && npm run db:migrate && npm run db:seed && npm run dev
```

### Pruebas

```bash
npm test     # 5 unitarias siempre; 14 de integración si hay DATABASE_URL
```

Las de integración crean reservas y suscriptores: úsalas contra una base de desarrollo, nunca contra producción.

### Sin backend (solo diseño)

`npx serve public` abre la web con el catálogo de ejemplo en modo demostración. Los formularios avisan de que no hay servidor.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de PostgreSQL. En Neon o Supabase, añade `?sslmode=require` |
| `APP_URL` | En producción | URL pública. Se usa en canonical, Open Graph, sitemap y retornos de Stripe |
| `PORT` | No | Por defecto, 3000 |
| `NODE_ENV` | No | `production` activa HSTS, la redirección a HTTPS y los logs en JSON |
| `TRUST_PROXY` | En PaaS | `1` detrás del balanceador de Render, Railway o Heroku (IPs reales para el rate limit) |
| `CORS_ORIGINS` | No | Orígenes extra separados por coma (p. ej. el dominio de Vercel si llama a la API directamente) |
| `ADMIN_API_KEY` | No | 32 caracteres o más. Activa `/api/admin/*` |
| `STRIPE_SECRET_KEY` | No | `sk_test_…`. Activa el pago de la seña |
| `STRIPE_WEBHOOK_SECRET` | Con Stripe | `whsec_…`. Sin ella, las reservas pagadas no se confirman solas |
| `RESEND_API_KEY` | No | `re_…`. Sin ella, los correos se escriben en la consola |
| `MAIL_FROM`, `MAIL_REPLY_TO` | No | Remitente verificado en Resend |
| `CLOUDINARY_CLOUD_NAME`, `_API_KEY`, `_API_SECRET` | No | CDN de imágenes y firma de subidas |

Todas se validan al arrancar: si una tiene un formato inválido, el proceso termina con un mensaje claro. Una variable vacía equivale a "no configurada".

---

## API REST

Base: `/api`. Todas las respuestas son JSON. Los errores siempre tienen la misma forma:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Hay datos que revisar.",
             "details": [{ "field": "email", "message": "Revisa el correo…" }], "requestId": "…" } }
```

| Método y ruta | Descripción | Límite |
|---|---|---|
| `GET /health` | Estado de la API y de la BD | – |
| `GET /config` | Pagos activos, moneda, seña e IVA | – |
| `GET /destinations` | `?category=playa\|montana\|ciudad\|aventura&featured=true&search=&maxDays=&sort=featured\|price_asc\|price_desc\|rating&page=&limit=` | 300 / 15 min (global) |
| `GET /destinations/:idOrSlug` | Detalle con paquetes, últimas reseñas y media | |
| `GET /packages` | `?destination=slug` | |
| `GET /packages/:slug/availability` | `?startDate=AAAA-MM-DD` → plazas libres | |
| `POST /quotes/calculate` | Desglose: alojamiento, experiencias, vuelos, IVA, total, por persona y validez | 60 / min |
| `POST /bookings` | Crea la reserva, comprueba plazas, calcula el precio en servidor, envía correo y (opcional) abre Stripe | 8 / hora |
| `POST /newsletter/subscribe` | Alta; 409 si ya está suscrito | 5 / hora |
| `GET /newsletter/unsubscribe` | `?token=` (enlace de los correos) → redirige con aviso | |
| `GET /reviews` | Solo las aprobadas + media | |
| `POST /reviews` | Entra en moderación (202) | 3 / hora |
| `POST /webhooks/stripe` | Evento firmado → confirma la reserva (idempotente) | |
| `PATCH /admin/bookings/:id/status` | `Authorization: Bearer ADMIN_API_KEY` | 30 / 15 min |
| `PATCH /admin/reviews/:id` | Aprobar o rechazar | |
| `POST /admin/uploads/signature` | Firma para subir imágenes directamente a Cloudinary | |

Códigos que se usan: `400` validación o JSON inválido, `401` admin, `404`, `409` duplicado o sin plazas, `413`, `429` rate limit, `500`, `503` servicio externo no configurado.

```bash
curl -X POST localhost:3000/api/quotes/calculate -H 'Content-Type: application/json' \
  -d '{"budgetPerNight":120,"nights":7,"travelers":2,"includeFlights":true,"destinationSlug":"tokio"}'

curl -X POST localhost:3000/api/bookings -H 'Content-Type: application/json' \
  -d '{"name":"Ana López","email":"ana@example.com","packageSlug":"bali-lento","startDate":"2026-12-10","travelers":2}'
```

---

## Base de datos

`prisma/schema.prisma` define cinco tablas: `destinations`, `packages`, `bookings`, `newsletter_subscribers` y `reviews` (columnas en snake_case). La migración inicial añade restricciones `CHECK` (valoración de 1 a 5, `end_date > start_date`, seña ≤ total…) para que la base de datos tampoco acepte datos imposibles.

- **Plazas:** un grupo es *paquete + fecha de salida* (máximo `max_group_size`). La reserva se crea en una transacción `SERIALIZABLE` con reintentos, así dos personas no pueden quedarse la última plaza a la vez.
- **Importes:** `DECIMAL(10,2)`, calculados siempre en el servidor con `shared/pricing.js`.
- **Reseñas:** nacen como `pending` y solo se publican las `approved`.

---

## Seguridad

- **Validación:** esquemas Zod `.strict()` en todos los cuerpos, con mensajes en español. El front usa las mismas reglas (`shared/constraints.js`).
- **XSS:** se eliminan las etiquetas HTML y los caracteres de control al guardar, el front escapa todo lo que pinta (`esc()`) y los correos usan `escapeHtml`. El JSON incrustado en el HTML escapa `<`, `>`, `&`, U+2028 y U+2029.
- **Inyección SQL:** solo Prisma, con consultas parametrizadas.
- **Cabeceras (Helmet):** CSP sin scripts en línea (`script-src 'self'`), HSTS, `frame-ancestors 'none'`, `nosniff`, Referrer-Policy y Permissions-Policy.
- **CORS:** lista blanca (`APP_URL` + `CORS_ORIGINS`).
- **Abuso:** rate limit por endpoint, campo trampa (honeypot) en los formularios y límite de 16 KB por cuerpo.
- **Administración:** Bearer token comparado en tiempo constante, con rate limit propio.
- **Pagos:** el importe sale del servidor, la confirmación llega solo por webhook firmado (la URL de retorno no confirma nada) y el front únicamente redirige a dominios `*.stripe.com`.
- **Secretos:** solo en `.env` / variables de la plataforma; `.env` está en `.gitignore` y `.dockerignore`. El cliente no recibe ninguna clave.

---

## Integraciones

**Stripe (sandbox)**
1. Pon la clave `sk_test_…` en `STRIPE_SECRET_KEY`.
2. En local, ejecuta `stripe listen --forward-to localhost:3000/api/webhooks/stripe` y copia el `whsec_…` en `STRIPE_WEBHOOK_SECRET`.
3. En producción, crea el webhook en el dashboard apuntando directamente al backend, con los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
4. Tarjeta de prueba: `4242 4242 4242 4242`.

**Resend.** Verifica tu dominio, crea una API key y define `MAIL_FROM` con ese dominio. Cada envío lleva una `Idempotency-Key` y un fallo de correo nunca rompe la reserva.

**Cloudinary.** Define las tres variables y activa *Fetched URL* en Settings → Security (con Unsplash en la lista de dominios permitidos). Las imágenes se sirven con `f_auto,q_auto` y `srcset` de 480, 800 y 1200 px. Para subir imágenes propias, pide una firma a `POST /api/admin/uploads/signature` y súbelas directamente desde el navegador: el secreto nunca sale del servidor.

---

## SEO, rendimiento y PWA

- `/` y `/destinos/:slug` se renderizan en el servidor con title, description, canonical, Open Graph, Twitter Card y JSON-LD (`TravelAgency`, `TouristTrip` con itinerario y oferta, `BreadcrumbList`). Un destino inexistente devuelve 404 con `noindex`.
- Los datos iniciales viajan incrustados en el HTML: el front pinta sin esperar a la API. Si la BD falla, se sirve la plantilla estática y el front recurre a la API o al catálogo local.
- Imágenes con `loading="lazy"`, `decoding="async"`, `srcset`/`sizes`, AVIF/WebP automático y efecto *blur-up*.
- Caché: la API pública usa `s-maxage` + `stale-while-revalidate` y los estáticos se revalidan con ETag (sin mezclar versiones de módulos).
- PWA: manifest con iconos *any* y *maskable*, favicon SVG que se adapta al modo oscuro, Service Worker *network-first* con página offline y catálogo disponible sin conexión.

---

## Despliegue

**Render (recomendado: un solo servicio).** Crea un Blueprint con `render.yaml`: crea el Postgres, aplica las migraciones y el seed en cada despliegue, genera `ADMIN_API_KEY` y vigila `/api/health`. Rellena `APP_URL` y las claves externas. HTTPS y certificado son automáticos, y con tu dominio Render emite el certificado de Let's Encrypt.

**Railway.** Crea un proyecto desde el repo y añade el plugin de PostgreSQL. Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `TRUST_PROXY=1`, `NODE_ENV=production` y `APP_URL`. Start command: `npx prisma migrate deploy && node server/src/index.js`.

**Vercel completo (front + API, sin tarjeta) + Neon.** `api/index.js` exporta la misma app Express como función serverless y `vercel.json` reenvía `/api/*`, `/destinos/*`, `sitemap.xml` y `robots.txt` a ella; `public/` se sirve desde el CDN. Pasos: (1) crea la base en Neon; (2) en GitHub, *Settings → Secrets → Actions*, crea `DATABASE_URL` (cadena directa de Neon, `?sslmode=require`) y lanza *Actions → Preparar base de datos* para aplicar migraciones y seed; (3) en Vercel, *Add New → Project*, importa el repo y define estas variables: `DATABASE_URL` (cadena *pooled* de Neon con `?sslmode=require&pgbouncer=true&connection_limit=1`), `NODE_ENV=production`, `TRUST_PROXY=1` y `APP_URL` (tu dominio de Vercel); (4) despliega. Limitaciones: el rate limit es en memoria y por instancia, y `/` se sirve como HTML estático (el SSR con SEO aplica a `/destinos/:slug`).

**Render (API en un servicio propio).** Alternativa con `render.yaml`; el plan gratuito exige tarjeta en algunas cuentas.

**Base de datos gestionada (Neon / Supabase).** Usa la cadena *pooled* con `?sslmode=require` para la app y la *direct* para `prisma migrate deploy`.

**HTTPS/SSL.** En producción, la app redirige http → https (con `TRUST_PROXY` configurado), envía HSTS con `preload` y la CSP incluye `upgrade-insecure-requests`. El certificado lo gestiona la plataforma (Render, Railway y Vercel lo emiten y renuevan solos). En un VPS propio, pon delante Caddy (`reverse_proxy localhost:3000`, TLS automático) o Nginx + Certbot.

---

## Micro-interacciones clave

1. **Toast que cambia de estado (`toast.promise`).** Al reservar aparece un toast con spinner ("Procesando tu reserva…"). Al responder el servidor, ese mismo toast se convierte en éxito o error: el icono entra con un *pop* (escala 0.4 → 1.18 → 1), la altura se recalcula y la pila se recoloca. Incluye la acción "Copiar referencia". La pila se expande al pasar el cursor o al enfocarla, y pausa sus temporizadores mientras tanto.
2. **Asientos de la salida.** Al elegir paquete y fecha, la disponibilidad real se dibuja como asientos que aparecen escalonados (25 ms por asiento). Los ocupados salen atenuados, los tuyos en el color de acento y, si no caben, en rojo con un mensaje claro.
3. **Cotizador verificado.** El precio se calcula al instante en el navegador y se anima con un contador de ease-out cuártico. En paralelo, el servidor lo verifica (con debounce y cancelando la petición anterior) y un punto de estado pasa de "pulsando" a verde con la validez del precio. Si eliges un destino, el slider de presupuesto se desliza solo hasta su precio medio por noche.
4. **Drawer tipo Vaul con URL propia.** El fondo se escala desde el centro de lo que ves y el panel se cierra arrastrando hacia abajo, según la distancia (28 %) o la velocidad (0,55 px/ms), con resistencia al tirar hacia arriba. La URL pasa a `/destinos/:slug`, compartible y renderizada con SEO en el servidor.
5. **Valoración con estrellas.** Las estrellas se iluminan al pasar el cursor, la elegida hace un *pop* con un pequeño giro y aparece una palabra ("¡Inolvidable!"). El formulario se despliega con `grid-template-rows: 0fr → 1fr` y queda `inert` mientras está cerrado.

Además: filtros con FLIP y píldora deslizante, tilt 3D con brillo que sigue al cursor, carrusel con inercia proyectada y *snap*, códigos de aeropuerto con efecto *flip*, ruta SVG que se traza con el scroll con paradas que muestran información, y formulario de reserva que "late" al precargarse desde el drawer o el cotizador. Todo con `cubic-bezier(0.23, 1, 0.32, 1)`, duraciones de 150 a 400 ms, `:active` a escala 0.97 y respeto a `prefers-reduced-motion`.
