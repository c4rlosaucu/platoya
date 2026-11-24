import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { httpError } from "../httpError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Dish } from "../models/Dish.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { serializeOrder } from "../serializers.js";
import { createPaypalOrder } from "../services/paypal.js";

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

async function ensurePaypalOrder(order) {
  if (order.paypalOrderId) return order;
  const paypal = await createPaypalOrder({
    orderId: order.id,
    totalCents: order.totalCents,
    currency: order.currency,
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
  return order;
}

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
