import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(serverRoot, ".env") });

const jwtSecret = process.env.JWT_SECRET?.trim() ?? "";
const missing = ["MONGODB_URI", "CLIENT_ORIGIN"].filter((key) => !process.env[key]?.trim());

if (!jwtSecret) missing.unshift("JWT_SECRET");

if (missing.length > 0) {
  console.error(`Faltan variables de entorno: ${missing.join(", ")}`);
  process.exit(1);
}

if (jwtSecret.length < 16) {
  console.error("JWT_SECRET debe tener al menos 16 caracteres");
  process.exit(1);
}

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port <= 0) {
  console.error("PORT no es un puerto válido");
  process.exit(1);
}

export const config = {
  port,
  mongodbUri: process.env.MONGODB_URI.trim(),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN.trim(),
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID?.trim() || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET?.trim() || "",
    apiBase: process.env.PAYPAL_API_BASE?.trim() || "https://api-m.sandbox.paypal.com",
    currency: process.env.PAYPAL_CURRENCY?.trim() || "USD",
  },
};
