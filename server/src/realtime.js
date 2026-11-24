import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { config } from "./config.js";
import { User } from "./models/User.js";

let io = null;

/**
 * Socket.IO dentro del mismo proceso que Express.
 * El handshake exige un JWT válido. Cada conexión entra en user:{id}
 * y solo el cocinero entra además en la sala kitchen. El cliente nunca elige sala.
 */
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    serveClient: false,
    cors: { origin: config.clientOrigin, methods: ["GET", "POST"] },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || !token) {
        next(new Error("UNAUTHORIZED"));
        return;
      }
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(payload.sub);
      if (!user) {
        next(new Error("UNAUTHORIZED"));
        return;
      }
      socket.data.user = { id: user._id.toString(), role: user.role };
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`);
    if (role === "cook") socket.join("kitchen");
  });

  return io;
}

/**
 * Avisa del cambio de estado con los datos mínimos.
 * La pantalla vuelve a pedir el pedido por REST.
 */
export function emitOrderStatus(order) {
  if (!io || !order) return;
  const payload = {
    orderId: order._id.toString(),
    status: order.status,
    updatedAt: order.updatedAt,
  };
  io.to(`user:${order.userId.toString()}`).emit("order:status", payload);
  if (order.status !== "PENDING_PAYMENT") io.to("kitchen").emit("order:status", payload);
}

export async function closeRealtime() {
  if (!io) return;
  await io.close();
  io = null;
}
