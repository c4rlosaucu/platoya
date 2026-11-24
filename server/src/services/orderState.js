import { Order } from "../models/Order.js";

/** Transiciones permitidas para la cocina. Nunca hay saltos ni retrocesos. */
export const NEXT_STATUS = {
  PAID: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
};

/**
 * Marca el pedido como pagado solo si sigue en PENDING_PAYMENT.
 * Devuelve { order, changed }.
 */
export async function markOrderPaid(orderId, userId) {
  const now = new Date();
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: "PENDING_PAYMENT" },
    {
      $set: { status: "PAID", paidAt: now },
      $push: { statusHistory: { status: "PAID", at: now, by: userId } },
    },
    { new: true },
  );
  if (updated) return { order: updated, changed: true };
  return { order: await Order.findById(orderId), changed: false };
}

/**
 * Avanza el pedido al estado siguiente de forma atómica.
 * Devuelve el pedido actualizado o null si otro cambio se adelantó.
 */
export async function advanceOrder(order, nextStatus, userId) {
  const now = new Date();
  return Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: { status: nextStatus },
      $push: { statusHistory: { status: nextStatus, at: now, by: userId } },
    },
    { new: true },
  );
}
