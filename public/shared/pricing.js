/* =========================================================
   Motor de precios compartido.
   El cotizador lo usa en el navegador para responder al instante
   y el servidor lo usa como fuente de verdad (cotización y reserva).
   El precio de una reserva nunca se acepta desde el cliente.
   ========================================================= */

export const PRICING = Object.freeze({
  currency: 'USD',
  experiencePerNight: 38, // experiencias con guía local, por persona y noche
  defaultFlight: 780,     // vuelo medio ida y vuelta por persona si no hay destino
  taxRate: 0.16,          // IVA sobre servicios turísticos (los vuelos ya lo traen)
  depositRate: 0.2        // seña para bloquear plazas
});

const round2 = n => Math.round(n * 100) / 100;

/** Estimado del cotizador. */
export function quote({ budgetPerNight, nights, travelers, includeFlights, flightEstimate = PRICING.defaultFlight }) {
  const lodging = budgetPerNight * nights * travelers;
  const experiences = PRICING.experiencePerNight * nights * travelers;
  const flights = includeFlights ? flightEstimate * travelers : 0;
  const subtotal = lodging + experiences + flights;
  const taxes = round2((lodging + experiences) * PRICING.taxRate);
  const total = round2(subtotal + taxes);
  return {
    currency: PRICING.currency,
    lodging: round2(lodging),
    experiences: round2(experiences),
    flights: round2(flights),
    subtotal: round2(subtotal),
    taxRate: PRICING.taxRate,
    taxes,
    total,
    perPerson: round2(total / travelers)
  };
}

/** Importe de una reserva de paquete (precio por persona × viajeros + IVA). */
export function bookingTotal({ pricePerPerson, travelers }) {
  const subtotal = round2(pricePerPerson * travelers);
  const taxes = round2(subtotal * PRICING.taxRate);
  const total = round2(subtotal + taxes);
  return {
    currency: PRICING.currency,
    unitPrice: round2(pricePerPerson),
    subtotal,
    taxes,
    total,
    deposit: round2(total * PRICING.depositRate)
  };
}
