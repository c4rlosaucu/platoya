import bcrypt from "bcrypt";
import mongoose from "mongoose";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { Dish } from "./models/Dish.js";
import { User } from "./models/User.js";

const dishes = [
  {
    name: "Arepa de queso",
    description: "Arepa blanca asada, rellena de queso fresco.",
    category: "Entradas",
    priceCents: 450,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1619096252214-ef06c45683e3?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Patacones con hogao",
    description: "Plátano verde aplastado y frito, con hogao de tomate y cebolla.",
    category: "Entradas",
    priceCents: 500,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Bandeja paisa",
    description: "Frijoles, arroz, carne molida, chicharrón, huevo, aguacate y arepa.",
    category: "Principales",
    priceCents: 1400,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Pollo a la brasa",
    description: "Medio pollo asado, papas al hilo y ensalada.",
    category: "Principales",
    priceCents: 1250,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Lomo saltado",
    description: "Lomo de res salteado con cebolla, tomate y papas fritas.",
    category: "Principales",
    priceCents: 1300,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Limonada de coco",
    description: "Limón, coco y un toque de azúcar.",
    category: "Bebidas",
    priceCents: 350,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Jugo de maracuyá",
    description: "Maracuyá natural, servido bien frío.",
    category: "Bebidas",
    priceCents: 300,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Tres leches",
    description: "Bizcocho empapado en tres leches, con canela.",
    category: "Postres",
    priceCents: 450,
    available: true,
    imageUrl: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1200&q=80",
  },
];

const users = [
  { name: "María Cocina", email: "cocinero@platoya.local", password: "Cocina1234", role: "cook" },
  { name: "Juan Pérez", email: "cliente@platoya.local", password: "Cliente1234", role: "customer" },
];

export async function seedDemo() {
  for (const dish of dishes) {
    await Dish.findOneAndUpdate({ name: dish.name }, dish, { upsert: true, returnDocument: "after" });
  }

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await User.findOneAndUpdate(
      { email: user.email },
      { name: user.name, email: user.email, passwordHash, role: user.role },
      { upsert: true },
    );
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") {
    console.error("Seed bloqueado en producción. Define SEED_DEMO=true para ejecutarlo a propósito.");
    process.exit(1);
  }

  try {
    await connectDb(config.mongodbUri);
  } catch {
    console.error("No se pudo conectar a MongoDB. Revisa MONGODB_URI.");
    process.exit(1);
  }

  await seedDemo();
  await mongoose.disconnect();
  console.log("Seed listo: 8 platos, un cocinero y un cliente de prueba.");
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  main().catch(() => {
    console.error("No se pudo completar el seed.");
    process.exit(1);
  });
}
