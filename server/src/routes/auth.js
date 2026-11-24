import bcrypt from "bcrypt";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { httpError } from "../httpError.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { User } from "../models/User.js";
import { serializeUser } from "../serializers.js";

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      error: { code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Espera un minuto." },
    });
  },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es demasiado corto").max(80, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .email("El correo no es válido")
    .max(120, "El correo es demasiado largo")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña es demasiado larga"),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("El correo no es válido")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "La contraseña es obligatoria").max(72, "La contraseña es demasiado larga"),
});

export const authRouter = Router();

authRouter.post("/register", authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      user = await User.create({ name, email, passwordHash, role: "customer" });
    } catch (error) {
      if (error?.code === 11000) {
        throw httpError(409, "CONFLICT", "Ya existe una cuenta con ese correo");
      }
      throw error;
    }

    res.status(201).json({ token: signToken(user), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !matches) {
      throw httpError(401, "UNAUTHORIZED", "Correo o contraseña incorrectos");
    }
    res.json({ token: signToken(user), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.profile });
});
