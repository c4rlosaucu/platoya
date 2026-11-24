import { httpError } from "../httpError.js";

/**
 * Prepara el cobro del total ya calculado en el servidor.
 * Sprint 2: no llama a PayPal. Sprint 3 sustituye este cuerpo por Orders API v2.
 */
export async function createPaypalOrder({ orderId, totalCents, currency }) {
  if (!orderId || !Number.isInteger(totalCents) || totalCents <= 0 || currency !== "USD") {
    throw httpError(500, "INTERNAL", "No se pudo preparar el cobro");
  }

  return {
    paypalOrderId: `FAKE-${orderId}`,
  };
}
