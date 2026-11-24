import { randomUUID } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { httpError } from "../httpError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Dish } from "../models/Dish.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { emitOrderStatus } from "../realtime.js";
import { serializeOrder } from "../serializers.js";
import { markOrderPaid } from "../services/orderState.js";
import {
  capturePaypalOrder,
  createPaypalOrder,
  getPaypalOrder,
  verifyCapturedOrder,
} from "../services/paypal.js";

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        dishId: z.string().trim().min(1, "El plato es obligatorio"),
        quantity: z
          .number({ invalid_type_error: "La cantidad debe ser un número" })
          .int("La cantidad debe ser un entero")
          .min(1, "La cantidad mínima es 1")
          .max(20, "La cantidad máxima es 20"),
      }),
    )
    .min(1, "El pedido no tiene platos")
    .max(30, "El pedido tiene demasiados platos"),
  address: z.object({
    line1: z.string().trim().min(4, "La dirección es demasiado corta").max(120, "La dirección es demasiado larga"),
    city: z.string().trim().min(2, "La ciudad es demasiado corta").max(80, "La ciudad es demasiado larga"),
    reference: z.string().trim().max(160, "La referencia es demasiado larga").optional(),
  }),
});

/**
 * Crea la orden de PayPal una sola vez por pedido (mismo PayPal-Request-Id).
 * Si PayPal falla, el pedido queda sin paypalOrderId y se reintenta en /paypal-order.
 */
async function ensurePaypalOrder(order) {
  if (order.paypalOrderId) return order;
  try {
    const paypal = await createPaypalOrder({
      orderId: order.id,
      totalCents: order.totalCents,
      currency: order.currency,
      requestId: `platoya-create-${order.id}`,
    });
    order.paypalOrderId = paypal.paypalOrderId;
    await order.save();
    await Payment.updateOne(
      { orderId: order._id },
      {
        $setOnInsert: {
          orderId: order._id,
          paypalOrderId: paypal.paypalOrderId,
          status: "CREATED",
          amountCents: order.totalCents,
          currency: "USD",
        },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("El pedido se guardó, pero la orden de PayPal quedó pendiente", error?.code || "");
  }
  return order;
}

async function findOwnedOrder(req) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw httpError(404, "NOT_FOUND", "Pedido no encontrado");
  }
  const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
  if (!order) throw httpError(404, "NOT_FOUND", "Pedido no encontrado");
  return order;
}

const USABLE_PAYPAL_STATUSES = ["CREATED", "SAVED", "APPROVED", "PAYER_ACTION_REQUIRED"];

function readIdempotencyKey(req) {
  const key = req.get("Idempotency-Key")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
    throw httpError(400, "VALIDATION_ERROR", "La clave de idempotencia no es válida");
  }
  return key;
}

function mergeItems(items) {
  const quantities = new Map();
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.dishId)) {
      throw httpError(400, "VALIDATION_ERROR", "Hay un plato que ya no está disponible");
    }
    quantities.set(item.dishId, (quantities.get(item.dishId) || 0) + item.quantity);
  }

  return [...quantities.entries()].map(([dishId, quantity]) => {
    if (quantity > 20) {
      throw httpError(400, "VALIDATION_ERROR", "La cantidad máxima por plato es 20");
    }
    return { dishId, quantity };
  });
}

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole("customer"));

ordersRouter.get("/", async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ orders: orders.map(serializeOrder) });
  } catch (error) {
    next(error);
  }
});

ordersRouter.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw httpError(404, "NOT_FOUND", "Pedido no encontrado");
    }
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) throw httpError(404, "NOT_FOUND", "Pedido no encontrado");
    res.json({ order: serializeOrder(order) });
  } catch (error) {
    next(error);
  }
});

ordersRouter.post("/", validateBody(createOrderSchema), async (req, res, next) => {
  try {
    const idempotencyKey = readIdempotencyKey(req);
    const existing = await Order.findOne({ userId: req.user.id, idempotencyKey });
    if (existing) {
      await ensurePaypalOrder(existing);
      res.status(200).json({ order: serializeOrder(existing) });
      return;
    }

    const requested = mergeItems(req.body.items);
    const dishes = await Dish.find({ _id: { $in: requested.map((item) => item.dishId) } });
    const dishesById = new Map(dishes.map((dish) => [dish._id.toString(), dish]));
    const items = requested.map((item) => {
      const dish = dishesById.get(item.dishId);
      if (!dish?.available) {
        throw httpError(400, "VALIDATION_ERROR", "Hay un plato que ya no está disponible");
      }
      return {
        dishId: dish._id,
        name: dish.name,
        unitPriceCents: dish.priceCents,
        quantity: item.quantity,
        lineTotalCents: dish.priceCents * item.quantity,
      };
    });
    const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

    let order;
    try {
      order = await Order.create({
        userId: req.user.id,
        items,
        address: {
          line1: req.body.address.line1,
          city: req.body.address.city,
          reference: req.body.address.reference ?? "",
        },
        totalCents,
        currency: "USD",
        status: "PENDING_PAYMENT",
        statusHistory: [{ status: "PENDING_PAYMENT", at: new Date(), by: req.user.id }],
        idempotencyKey,
      });
    } catch (error) {
      if (error?.code === 11000) {
        const raced = await Order.findOne({ userId: req.user.id, idempotencyKey });
        if (raced) {
          await ensurePaypalOrder(raced);
          res.status(200).json({ order: serializeOrder(raced) });
          return;
        }
      }
      throw error;
    }

    await ensurePaypalOrder(order);
    res.status(201).json({ order: serializeOrder(order) });
  } catch (error) {
    next(error);
  }
});

/**
 * Devuelve la orden de PayPal que debe aprobar el comprador.
 * Reutiliza la existente si sigue vigente. Si caducó, crea otra con el total ya guardado.
 */
ordersRouter.post("/:id/paypal-order", async (req, res, next) => {
  try {
    const order = await findOwnedOrder(req);
    if (order.status !== "PENDING_PAYMENT") {
      throw httpError(409, "CONFLICT", "Este pedido ya no está pendiente de pago");
    }

    const payment = await Payment.findOne({ orderId: order._id });
    if (payment?.status === "CAPTURE_PENDING") {
      throw httpError(409, "CONFLICT", "Hay un pago en curso para este pedido");
    }
    if (payment?.status === "CAPTURED") {
      throw httpError(409, "CONFLICT", "Este pedido ya tiene un pago capturado");
    }

    if (order.paypalOrderId && payment?.status === "CREATED") {
      const existing = await getPaypalOrder(order.paypalOrderId);
      if (existing && USABLE_PAYPAL_STATUSES.includes(existing.status)) {
        res.json({ paypalOrderId: order.paypalOrderId });
        return;
      }
      if (existing?.status === "COMPLETED") {
        throw httpError(409, "CONFLICT", "PayPal ya cobró este pedido. Actualiza la página para ver su estado");
      }
    }

    const paypal = await createPaypalOrder({
      orderId: order.id,
      totalCents: order.totalCents,
      currency: order.currency,
      requestId: randomUUID(),
    });
    order.paypalOrderId = paypal.paypalOrderId;
    await order.save();
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          paypalOrderId: paypal.paypalOrderId,
          status: "CREATED",
          paypalStatus: "",
          amountCents: order.totalCents,
          currency: "USD",
        },
        $unset: { captureId: "", capturedAt: "" },
      },
      { upsert: true },
    );
    res.json({ paypalOrderId: paypal.paypalOrderId });
  } catch (error) {
    next(error);
  }
});

/**
 * Captura el pago y confirma el pedido. Solo el servidor decide que está pagado.
 * Idempotente: un pedido ya pagado devuelve el mismo resultado sin volver a capturar.
 */
ordersRouter.post("/:id/capture", async (req, res, next) => {
  try {
    const order = await findOwnedOrder(req);
    if (order.status !== "PENDING_PAYMENT") {
      res.json({ order: serializeOrder(order) });
      return;
    }

    // Paso atómico: solo una solicitud pasa de CREATED a CAPTURE_PENDING.
    const payment = await Payment.findOneAndUpdate(
      { orderId: order._id, status: "CREATED" },
      { $set: { status: "CAPTURE_PENDING" } },
      { new: true },
    );

    if (!payment) {
      const current = await Payment.findOne({ orderId: order._id });
      if (!current) throw httpError(409, "CONFLICT", "Este pedido todavía no tiene un pago iniciado");
      if (current.status === "CAPTURE_PENDING") {
        throw httpError(409, "CONFLICT", "La captura de este pago ya está en curso");
      }
      if (current.status === "CAPTURED") {
        const { order: paid, changed } = await markOrderPaid(order._id, req.user.id);
        if (changed) emitOrderStatus(paid);
        res.json({ order: serializeOrder(paid) });
        return;
      }
      throw httpError(402, "PAYMENT_MISMATCH", "El pago anterior no coincidió con el pedido. Inicia el pago de nuevo");
    }

    const claimed = req.body?.paypalOrderId;
    if (typeof claimed === "string" && claimed && claimed !== payment.paypalOrderId) {
      await Payment.updateOne({ _id: payment._id, status: "CAPTURE_PENDING" }, { $set: { status: "CREATED" } });
      throw httpError(400, "VALIDATION_ERROR", "La orden de PayPal no corresponde a este pedido");
    }

    let paypalOrder;
    try {
      const result = await capturePaypalOrder(payment.paypalOrderId, `platoya-capture-${order.id}`);
      paypalOrder = result.alreadyCaptured ? await getPaypalOrder(payment.paypalOrderId) : result.order;
      if (!paypalOrder) throw httpError(502, "PAYPAL_ERROR", "No se pudo confirmar el pago en PayPal");
    } catch (error) {
      // Error de red o rechazo: el pedido sigue sin pagar y el cliente puede reintentar.
      await Payment.updateOne({ _id: payment._id, status: "CAPTURE_PENDING" }, { $set: { status: "CREATED" } });
      throw error;
    }

    const check = verifyCapturedOrder(paypalOrder, {
      orderId: order.id,
      totalCents: order.totalCents,
      currency: order.currency,
    });
    if (!check.ok) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { status: "FAILED", paypalStatus: String(paypalOrder.status || "") } },
      );
      throw httpError(402, "PAYMENT_MISMATCH", "El pago no coincide con el pedido, por eso no se confirmó");
    }

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "CAPTURED",
          captureId: check.captureId,
          paypalStatus: String(paypalOrder.status),
          capturedAt: new Date(),
        },
      },
    );
    const { order: paid, changed } = await markOrderPaid(order._id, req.user.id);
    if (changed) emitOrderStatus(paid);
    res.json({ order: serializeOrder(paid) });
  } catch (error) {
    next(error);
  }
});
