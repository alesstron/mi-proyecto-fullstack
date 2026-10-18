/* =========================================================
   Catálogo de ejemplo.
   - El seed de la base de datos lo inserta (prisma/seed.js).
   - El front lo carga solo como respaldo si la API no responde
     (p. ej. desplegado como sitio estático sin backend).
   ========================================================= */

const U = id => `https://images.unsplash.com/${id}`;

export const DESTINATIONS = [
  {
    slug: 'cancun', title: 'Cancún', country: 'México', location: 'Quintana Roo, México',
    category: 'playa', tags: [], pricePerNight: 110, flightEstimate: 420, rating: 4.7, featured: true,
    emoji: '🌊', gradient: 'linear-gradient(135deg,#2BB3C0,#7ED6C8 55%,#F5E2B8)',
    images: [U('photo-1510097467424-192d713fd8b2')],
    description: 'Caribe turquesa, cenotes escondidos y pueblos mayas donde el tiempo va más lento. Te llevamos lejos de la zona hotelera, a Holbox y Valladolid.'
  },
  {
    slug: 'machu-picchu', title: 'Machu Picchu', country: 'Perú', location: 'Cusco, Perú',
    category: 'montana', tags: ['aventura'], pricePerNight: 95, flightEstimate: 690, rating: 4.9, featured: true,
    emoji: '⛰️', gradient: 'linear-gradient(135deg,#3F7D5C,#9CC59A 55%,#E9DDB5)',
    images: [U('photo-1587595431973-160d0d94add1')],
    description: 'La ciudadela inca al amanecer, el Valle Sagrado con familias quechuas y Cusco a ritmo de aclimatación. Altura, historia y mucha calma.'
  },
  {
    slug: 'santorini', title: 'Santorini', country: 'Grecia', location: 'Cícladas, Grecia',
    category: 'playa', tags: [], pricePerNight: 190, flightEstimate: 980, rating: 4.8, featured: true,
    emoji: '🏛️', gradient: 'linear-gradient(135deg,#2A6F97,#9CC9E6 55%,#F7F2EA)',
    images: [U('photo-1570077188670-e3a8d69ac5ff')],
    description: 'Caldera volcánica, vino de viñas centenarias y velero entre islas blancas. Santorini, sí, pero también Naxos y Paros sin multitudes.'
  },
  {
    slug: 'tokio', title: 'Tokio', country: 'Japón', location: 'Kantō, Japón',
    category: 'ciudad', tags: [], pricePerNight: 170, flightEstimate: 1250, rating: 4.9, featured: true,
    emoji: '🏮', gradient: 'linear-gradient(135deg,#3B2A5A,#D81F5B 60%,#F6A6B2)',
    images: [U('photo-1540959733332-eab4deabeeaf')],
    description: 'Izakayas sin letrero, templos al amanecer y un ryokan con onsen frente al Fuji. Tokio, Kioto y Nara con alguien que vive allí.'
  },
  {
    slug: 'patagonia', title: 'Patagonia', country: 'Argentina y Chile', location: 'El Chaltén y Torres del Paine',
    category: 'montana', tags: ['aventura'], pricePerNight: 140, flightEstimate: 860, rating: 4.8, featured: true,
    emoji: '🏔️', gradient: 'linear-gradient(135deg,#355C7D,#8FB3C9 55%,#E8EEF2)',
    images: [U('photo-1531794343213-5a13e9a9a2b5')],
    description: 'Glaciares que crujen, trekkings a lagunas imposibles y refugios con estufa de leña. El fin del mundo con guías de montaña certificados.'
  },
  {
    slug: 'bali', title: 'Bali', country: 'Indonesia', location: 'Ubud y Nusa Penida, Indonesia',
    category: 'playa', tags: ['aventura'], pricePerNight: 85, flightEstimate: 1180, rating: 4.7, featured: true,
    emoji: '🌺', gradient: 'linear-gradient(135deg,#1F6B5C,#7BC08A 55%,#F5B841)',
    images: [U('photo-1537996194471-e657df975ab4')],
    description: 'Arrozales en bici, templos de agua y snorkel con mantarrayas. Un Bali lento, de villas pequeñas y cocina en casa de familia.'
  }
];

const day = (title, description) => ({ title, description });

export const PACKAGES = [
  {
    slug: 'caribe-sin-prisa', destination: 'cancun', title: 'Caribe sin prisa', route: 'Cancún, Tulum y Holbox',
    days: 8, pricePerPerson: 1290, maxGroupSize: 12, emoji: '🐢',
    itinerary: [day('Llegada a Cancún', 'Traslado a un hotel boutique frente al mar.'), day('Cenotes de Valladolid', 'Nado en tres cenotes con guía maya.'), day('Tulum al amanecer', 'Ruinas antes de que lleguen los grupos.'), day('Holbox', 'Dos noches en la isla sin coches.')],
    includes: ['7 noches de alojamiento', 'Traslados privados', 'Guía local bilingüe', 'Seguro de viaje']
  },
  {
    slug: 'camino-a-las-nubes', destination: 'machu-picchu', title: 'Camino a las nubes', route: 'Cusco, Valle Sagrado y Machu Picchu',
    days: 9, pricePerPerson: 1680, maxGroupSize: 12, emoji: '🦙',
    itinerary: [day('Aclimatación en Cusco', 'Paseo lento por San Blas y mate de coca.'), day('Valle Sagrado', 'Mercado de Pisac y comida en casa de familia.'), day('Tren a Aguas Calientes', 'Vagón panorámico entre montañas.'), day('Machu Picchu', 'Entrada al amanecer con Quispe, tu guía.')],
    includes: ['8 noches de alojamiento', 'Entradas a Machu Picchu', 'Tren Vistadome', 'Desayunos diarios']
  },
  {
    slug: 'cicladas-en-velero', destination: 'santorini', title: 'Cícladas en velero', route: 'Santorini, Naxos y Paros',
    days: 10, pricePerPerson: 2450, maxGroupSize: 8, emoji: '⛵',
    itinerary: [day('Santorini', 'Atardecer en Oia, lejos del mirador lleno.'), day('Zarpe a Naxos', 'Tres días a bordo con patrón local.'), day('Paros', 'Pueblos blancos y tabernas de pescadores.'), day('Regreso por la caldera', 'Baño en aguas termales volcánicas.')],
    includes: ['Camarote doble en velero', 'Patrón y cocinero', 'Ferry entre islas', 'Cata de vinos volcánicos']
  },
  {
    slug: 'tokio-de-noche-y-de-dia', destination: 'tokio', title: 'Tokio de noche y de día', route: 'Tokio, Kioto y Nara',
    days: 12, pricePerPerson: 2980, maxGroupSize: 12, emoji: '🍣',
    itinerary: [day('Tokio', 'Izakayas escondidas en Shinjuku con Kenji.'), day('Hakone', 'Ryokan con onsen y vistas al Fuji.'), day('Kioto', 'Templos al amanecer y ceremonia del té.'), day('Nara', 'Bosque de Kasuga y ciervos sagrados.')],
    includes: ['11 noches (2 en ryokan)', 'Japan Rail Pass 7 días', 'Tarjeta Suica cargada', 'Cena kaiseki']
  },
  {
    slug: 'fin-del-mundo', destination: 'patagonia', title: 'Fin del mundo', route: 'El Chaltén, El Calafate y Torres del Paine',
    days: 11, pricePerPerson: 2340, maxGroupSize: 10, emoji: '🧭',
    itinerary: [day('El Calafate', 'Pasarelas del glaciar Perito Moreno.'), day('El Chaltén', 'Trekking a Laguna de los Tres.'), day('Cruce a Chile', 'Estepa, guanacos y cielo enorme.'), day('Torres del Paine', 'Dos noches en refugio de montaña.')],
    includes: ['10 noches de alojamiento', 'Equipo técnico de trekking', 'Guía de montaña certificado', 'Traslados terrestres']
  },
  {
    slug: 'bali-lento', destination: 'bali', title: 'Bali lento', route: 'Ubud, Amed y Nusa Penida',
    days: 10, pricePerPerson: 1590, maxGroupSize: 12, emoji: '🌴',
    itinerary: [day('Ubud', 'Arrozales de Jatiluwih en bici con Wayan.'), day('Templos de agua', 'Ceremonia de purificación en Tirta Empul.'), day('Amed', 'Snorkel en el naufragio del Liberty.'), day('Nusa Penida', 'Acantilados y mantarrayas.')],
    includes: ['9 noches en villas', 'Clase de cocina balinesa', 'Barco a Nusa Penida', 'Seguro de viaje']
  }
];

export const REVIEWS = [
  { authorName: 'Lucía Ferrer', authorLocation: 'Madrid', destination: 'patagonia', rating: 5,
    comment: 'En Patagonia hubo un día de viento imposible y Martina nos cambió la ruta en diez minutos. Nunca me sentí un turista, me sentí acompañada.' },
  { authorName: 'Diego Ramírez', authorLocation: 'Monterrey', destination: 'tokio', rating: 5,
    comment: 'La izakaya a la que nos llevó Kenji no tenía ni letrero. Volvimos dos veces. Todo el viaje fue así de bien pensado.' },
  { authorName: 'Ana y Tomás', authorLocation: 'Bogotá', destination: 'bali', rating: 5,
    comment: 'Pagamos exactamente lo que decía la propuesta. Ni un cargo extra en diez días. Eso, para nosotros, vale oro.' },
  { authorName: 'Valeria Ortiz', authorLocation: 'Santiago', destination: 'machu-picchu', rating: 5,
    comment: 'Llegar a Machu Picchu antes de que abrieran las puertas, con la niebla subiendo, es de esas cosas que no se olvidan.' },
  { authorName: 'Marcos Gil', authorLocation: 'Buenos Aires', destination: 'santorini', rating: 4,
    comment: 'Tres días de velero con Eleni y su familia cocinando a bordo. El ferry de vuelta se retrasó, pero lo resolvieron antes de que nos diéramos cuenta.' }
];
