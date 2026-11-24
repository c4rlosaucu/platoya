import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { httpError } from "../httpError.js";

/**
 * Cliente mínimo de PayPal Orders API v2.
 * Solo el servidor usa el secreto. Nunca se registra el cuerpo de las respuestas.
 */

const TIMEOUT_MS = 15000;
let cachedToken = null;

function assertConfigured() {
  if (!config.paypal.clientId || !config.paypal.clientSecret) {
    throw httpError(503, "PAYPAL_NOT_CONFIGURED", "El pago con PayPal no está disponible por ahora");
  }
}

export function formatAmount(cents) {
  return (cents / 100).toFixed(2);
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  let response;
  try {
    response = await fetch(`${config.paypal.apiBase}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw httpError(502, "PAYPAL_UNAVAILABLE", "No se pudo contactar a PayPal. Intenta de nuevo");
  }
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function getAccessToken() {
  assertConfigured();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.value;

  const basic = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64");
  const { status, data } = await request("/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (status !== 200 || !data?.access_token) {
    console.error("PayPal rechazó la autenticación de la aplicación", status);
    throw httpError(502, "PAYPAL_AUTH", "No se pudo autenticar con PayPal");
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 300) * 1000,
  };
  return cachedToken.value;
}

async function authorized(path, { method = "GET", body, requestId } = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    Prefer: "return=representation",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  return request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

/**
 * Crea la orden de PayPal con el total que el servidor ya calculó.
 * custom_id e invoice_id llevan el id del pedido local.
 */
export async function createPaypalOrder({ orderId, totalCents, currency, requestId }) {
  if (!orderId || !Number.isInteger(totalCents) || totalCents <= 0 || currency !== "USD") {
    throw httpError(500, "INTERNAL", "No se pudo preparar el cobro");
  }

  const { status, data } = await authorized("/v2/checkout/orders", {
    method: "POST",
    requestId: requestId || randomUUID(),
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: String(orderId),
          custom_id: String(orderId),
          invoice_id: String(orderId),
          description: "Pedido PlatoYa",
          amount: { currency_code: currency, value: formatAmount(totalCents) },
        },
      ],
      application_context: {
        brand_name: "PlatoYa",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    },
  });

  if (status >= 400 || !data?.id) {
    console.error("PayPal no pudo crear la orden", status, data?.name || "");
    throw httpError(502, "PAYPAL_ERROR", "No se pudo preparar el pago con PayPal");
  }
  return { paypalOrderId: data.id, status: data.status };
}

/** Devuelve la orden de PayPal o null si ya no existe. */
export async function getPaypalOrder(paypalOrderId) {
  const { status, data } = await authorized(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
  if (status === 404) return null;
  if (status >= 400) {
    console.error("PayPal no pudo consultar la orden", status);
    throw httpError(502, "PAYPAL_ERROR", "No se pudo consultar el pago en PayPal");
  }
  return data;
}

/**
 * Captura la orden aprobada por el comprador.
 * Devuelve { order } o { alreadyCaptured: true }. Si PayPal la rechaza lanza 402.
 */
export async function capturePaypalOrder(paypalOrderId, requestId) {
  const { status, data } = await authorized(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    requestId: requestId || randomUUID(),
    body: {},
  });

  if (status === 200 || status === 201) return { order: data };

  const issues = Array.isArray(data?.details) ? data.details.map((detail) => detail.issue) : [];
  if (status === 422 && issues.includes("ORDER_ALREADY_CAPTURED")) return { alreadyCaptured: true };
  if (status === 422) {
    throw httpError(402, "PAYMENT_NOT_APPROVED", "PayPal no aprobó el pago. Puedes intentarlo otra vez");
  }
  if (status === 404) {
    throw httpError(409, "CONFLICT", "La orden de PayPal ya no existe. Inicia el pago de nuevo");
  }
  console.error("PayPal no pudo capturar la orden", status, data?.name || "");
  throw httpError(502, "PAYPAL_ERROR", "No se pudo completar el pago con PayPal");
}

/**
 * Verifica estado, moneda, importe e identificador del pedido en la respuesta de PayPal.
 */
export function verifyCapturedOrder(paypalOrder, { orderId, totalCents, currency }) {
  const unit = paypalOrder?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const amountCents = Math.round(Number.parseFloat(capture?.amount?.value) * 100);

  const ok =
    paypalOrder?.status === "COMPLETED" &&
    capture?.status === "COMPLETED" &&
    unit?.custom_id === String(orderId) &&
    capture?.amount?.currency_code === currency &&
    amountCents === totalCents;

  return { ok, captureId: ok ? capture.id : "" };
}
