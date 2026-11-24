import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { httpError } from "../httpError.js";
import { User } from "../models/User.js";
import { serializeUser } from "../serializers.js";

export async function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    next(httpError(401, "UNAUTHORIZED", "Inicia sesión para continuar"));
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || (payload.role !== "customer" && payload.role !== "cook")) {
      next(httpError(401, "UNAUTHORIZED", "La sesión no es válida"));
      return;
    }
    req.user = { id: user._id.toString(), role: user.role };
    req.profile = serializeUser(user);
    next();
  } catch {
    next(httpError(401, "UNAUTHORIZED", "La sesión no es válida"));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(httpError(403, "FORBIDDEN", "No tienes permiso para esta acción"));
      return;
    }
    next();
  };
}

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}
