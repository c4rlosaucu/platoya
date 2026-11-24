import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";

const app = createApp();

try {
  await connectDb(config.mongodbUri);
} catch {
  console.error("No se pudo conectar a MongoDB. Revisa MONGODB_URI.");
  process.exit(1);
}

app.listen(config.port, "0.0.0.0", () => {
  console.log(`PlatoYa API escuchando en 0.0.0.0:${config.port}`);
});
