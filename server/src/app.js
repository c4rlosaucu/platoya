import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { config } from "./config.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { dishesRouter } from "./routes/dishes.js";
import { kitchenRouter } from "./routes/kitchen.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === config.clientOrigin) {
          callback(null, true);
          return;
        }
        const error = new Error("Origen no permitido");
        error.status = 403;
        error.code = "FORBIDDEN";
        callback(error);
      },
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    }),
  );

  if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (req, res) => {
    const db = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({ ok: true, db });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/dishes", dishesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/kitchen", kitchenRouter);

  app.use((req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
  });
  app.use(errorHandler);
  return app;
}
