import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { initRealtime } from "./realtime.js";

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

try {
  await connectDb(config.mongodbUri);
} catch {
  console.error("No se pudo conectar a MongoDB. Revisa MONGODB_URI.");
  process.exit(1);
}

server.listen(config.port, "0.0.0.0", () => {
  console.log(`PlatoYa API escuchando en 0.0.0.0:${config.port}`);
});
