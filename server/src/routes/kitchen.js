import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { httpError } from "../httpError.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Order } from "../models/Order.js";
import { emitOrderStatus } from "../realtime.js";
import { serializeOrder } from "../serializers.js";
import { NEXT_STATUS, advanceOrder } from "../services/orderState.js";

const statusSchema = z.object({
  status: z.enum(["PENDING_PAYMENT", "PAID", "PREPARING", "READY", "DELIVERED"], {
    errorMap: () => ({ message: "El estado no es válido" }),
  }),
});

export const kitchenRouter = Router();

kitchenRouter.use(requireAuth, requireRole("cook"));

kitchenRouter.get("/orders", async (req, res, next) => {
  try {
    const active = await Order.find({ status: { $in: ["PAID", "PREPARING", "READY"] } }).sort({ paidAt: 1 });
    const delivered = await Order.find({ status: "DELIVERED" }).sort({ updatedAt: -1 }).limit(30);
    res.json({ orders: [...active, ...delivered].map(serializeOrder) });
  } catch (error) {
    next(error);
  }
});

kitchenRouter.patch("/orders/:id/status", validateBody(statusSchema), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw httpError(404, "NOT_FOUND", "Pedido no encontrado");
    }
    const order = await Order.findById(req.params.id);
    if (!order || order.status === "PENDING_PAYMENT") {
      throw httpError(404, "NOT_FOUND", "Pedido no encontrado");
    }

    const target = NEXT_STATUS[order.status];
    if (!target || req.body.status !== target) {
      throw httpError(409, "ILLEGAL_TRANSITION", "Ese cambio de estado no está permitido");
    }

    const updated = await advanceOrder(order, target, req.user.id);
    if (!updated) {
      throw httpError(409, "CONFLICT", "El pedido cambió mientras tanto. Actualiza el tablero");
    }
    emitOrderStatus(updated);
    res.json({ order: serializeOrder(updated) });
  } catch (error) {
    next(error);
  }
});
