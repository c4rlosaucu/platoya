import { Router } from "express";
import { config } from "../config.js";
import { httpError } from "../httpError.js";

export const paymentsRouter = Router();

/** El client ID de PayPal es público. El secreto nunca sale del servidor. */
paymentsRouter.get("/config", (req, res, next) => {
  if (!config.paypal.clientId) {
    next(httpError(503, "PAYPAL_NOT_CONFIGURED", "El pago con PayPal no está disponible por ahora"));
    return;
  }
  res.json({ clientId: config.paypal.clientId, currency: config.paypal.currency });
});
