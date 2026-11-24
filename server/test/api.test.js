import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as connectSocket } from "socket.io-client";
import request from "supertest";

/**
 * Pruebas de integración. No usan red externa ni Atlas:
 * MongoDB corre en memoria y PayPal se sustituye por un servidor HTTP local.
 */

// ---------- PayPal simulado ----------
const paypal = {
  orders: new Map(),
  counter: 0,
  captureMode: "ok", // ok | declined | down
  captureCalls: 0,
  createCalls: 0,
  amountOverride: null,
};

function resetPaypal() {
  paypal.orders.clear();
  paypal.captureMode = "ok";
  paypal.captureCalls = 0;
  paypal.createCalls = 0;
  paypal.amountOverride = null;
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const mockPaypal = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const { pathname } = new URL(req.url, "http://localhost");

  if (req.method === "POST" && pathname === "/v1/oauth2/token") {
    send(200, { access_token: "token-de-prueba", expires_in: 3600 });
    return;
  }

  if (req.method === "POST" && pathname === "/v2/checkout/orders") {
    const body = await readJson(req);
    const unit = body.purchase_units[0];
    const id = `MOCK-${++paypal.counter}`;
    paypal.createCalls += 1;
    paypal.orders.set(id, {
      id,
      status: "CREATED",
      purchase_units: [{ custom_id: unit.custom_id, amount: unit.amount }],
    });
    send(201, paypal.orders.get(id));
    return;
  }

  const match = pathname.match(/^\/v2\/checkout\/orders\/([^/]+)(\/capture)?$/);
  if (match) {
    const order = paypal.orders.get(match[1]);
    if (!order) {
      send(404, { name: "RESOURCE_NOT_FOUND" });
      return;
    }
    if (req.method === "GET" && !match[2]) {
      send(200, order);
      return;
    }
    if (req.method === "POST" && match[2]) {
      paypal.captureCalls += 1;
      if (paypal.captureMode === "down") {
        send(503, { name: "SERVICE_UNAVAILABLE" });
        return;
      }
      if (paypal.captureMode === "declined") {
        send(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] });
        return;
      }
      if (order.status === "COMPLETED") {
        send(422, { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] });
        return;
      }
      order.status = "COMPLETED";
      const unit = order.purchase_units[0];
      unit.payments = {
        captures: [
          { id: `CAP-${order.id}`, status: "COMPLETED", amount: paypal.amountOverride || unit.amount },
        ],
      };
      send(201, order);
      return;
    }
  }

  send(404, { name: "NOT_FOUND" });
});

// ---------- Aplicación bajo prueba ----------
let mongod;
let app;
let server;
let baseUrl;
let models;
let signToken;
let closeRealtime;
let mongoose;

before(async () => {
  await new Promise((resolve) => mockPaypal.listen(0, "127.0.0.1", resolve));
  // TEST_MONGODB_URI permite usar otro MongoDB local. Por defecto se usa MongoDB en memoria.
  if (!process.env.TEST_MONGODB_URI) mongod = await MongoMemoryServer.create();

  Object.assign(process.env, {
    NODE_ENV: "test",
    PORT: "4999",
    MONGODB_URI: process.env.TEST_MONGODB_URI || mongod.getUri("platoya_test"),
    JWT_SECRET: "secreto-de-pruebas-muy-largo",
    CLIENT_ORIGIN: "http://localhost:3000",
    PAYPAL_CLIENT_ID: "client-id-de-prueba",
    PAYPAL_CLIENT_SECRET: "secreto-paypal-de-prueba",
    PAYPAL_API_BASE: `http://127.0.0.1:${mockPaypal.address().port}`,
    PAYPAL_CURRENCY: "USD",
  });

  const { createApp } = await import("../src/app.js");
  const { connectDb } = await import("../src/db.js");
  const { initRealtime, closeRealtime: close } = await import("../src/realtime.js");
  ({ signToken } = await import("../src/middleware/auth.js"));
  const { User } = await import("../src/models/User.js");
  const { Dish } = await import("../src/models/Dish.js");
  const { Order } = await import("../src/models/Order.js");
  const { Payment } = await import("../src/models/Payment.js");
  mongoose = (await import("mongoose")).default;
  models = { User, Dish, Order, Payment };
  closeRealtime = close;

  await connectDb(process.env.MONGODB_URI);
  app = createApp();
  server = http.createServer(app);
  initRealtime(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await closeRealtime?.();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  server?.closeAllConnections?.();
  await mongoose?.disconnect();
  await mongod?.stop();
  mockPaypal.closeAllConnections?.();
  await new Promise((resolve) => mockPaypal.close(resolve));
});

let ana;
let beto;
let cook;
let arepa;
let bandeja;
let agotado;

async function makeUser(name, email, role) {
  const passwordHash = await bcrypt.hash("Clave12345", 4);
  const user = await models.User.create({ name, email, passwordHash, role });
  return { user, token: signToken(user) };
}

beforeEach(async () => {
  resetPaypal();
  await Promise.all([
    models.User.deleteMany({}),
    models.Dish.deleteMany({}),
    models.Order.deleteMany({}),
    models.Payment.deleteMany({}),
  ]);
  ana = await makeUser("Ana", "ana@test.local", "customer");
  beto = await makeUser("Beto", "beto@test.local", "customer");
  cook = await makeUser("Cocinero", "cook@test.local", "cook");
  [arepa, bandeja, agotado] = await models.Dish.create([
    { name: "Arepa", description: "Arepa", category: "Entradas", priceCents: 450, available: true, imageUrl: "http://x/a.jpg" },
    { name: "Bandeja", description: "Bandeja", category: "Principales", priceCents: 1400, available: true, imageUrl: "http://x/b.jpg" },
    { name: "Agotado", description: "Agotado", category: "Postres", priceCents: 300, available: false, imageUrl: "http://x/c.jpg" },
  ]);
});

const address = { line1: "Calle 10 # 20-30", city: "Medellin" };
let keyCounter = 0;
const newKey = () => `clave-de-prueba-${++keyCounter}-${Date.now()}`;

function createOrder(token, items, key = newKey()) {
  return request(baseUrl)
    .post("/api/orders")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send({ items, address });
}

async function orderOf(token, items = [{ dishId: arepa.id, quantity: 2 }]) {
  const res = await createOrder(token, items);
  assert.equal(res.status, 201);
  return res.body.order;
}

function capture(token, orderId, paypalOrderId) {
  return request(baseUrl)
    .post(`/api/orders/${orderId}/capture`)
    .set("Authorization", `Bearer ${token}`)
    .send(paypalOrderId ? { paypalOrderId } : {});
}

describe("autenticación y roles", () => {
  it("el registro público siempre crea un cliente, aunque pida cocinero", async () => {
    const res = await request(baseUrl)
      .post("/api/auth/register")
      .send({ name: "Intruso", email: "intruso@test.local", password: "Clave12345", role: "cook" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "customer");
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it("el login correcto devuelve token y el incorrecto responde 401 sin hash", async () => {
    const ok = await request(baseUrl).post("/api/auth/login").send({ email: "ana@test.local", password: "Clave12345" });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.passwordHash, undefined);

    const bad = await request(baseUrl).post("/api/auth/login").send({ email: "ana@test.local", password: "incorrecta1" });
    assert.equal(bad.status, 401);
    assert.equal(JSON.stringify(bad.body).includes("$2"), false);
  });

  it("sin token las rutas protegidas responden 401", async () => {
    const res = await request(baseUrl).get("/api/orders");
    assert.equal(res.status, 401);
  });

  it("un cliente no accede a la cocina (403) y un cocinero no crea pedidos (403)", async () => {
    const kitchen = await request(baseUrl).get("/api/kitchen/orders").set("Authorization", `Bearer ${ana.token}`);
    assert.equal(kitchen.status, 403);

    const res = await createOrder(cook.token, [{ dishId: arepa.id, quantity: 1 }]);
    assert.equal(res.status, 403);
  });
});

describe("pedidos", () => {
  it("ignora el precio enviado por el navegador y recalcula el total en el servidor", async () => {
    const res = await createOrder(ana.token, [
      { dishId: arepa.id, quantity: 2, priceCents: 1, unitPriceCents: 1 },
      { dishId: bandeja.id, quantity: 1, priceCents: 1 },
    ]);
    assert.equal(res.status, 201);
    assert.equal(res.body.order.totalCents, 2 * 450 + 1400);
    assert.equal(res.body.order.status, "PENDING_PAYMENT");
  });

  it("rechaza cantidades inválidas, platos no disponibles y direcciones vacías", async () => {
    const negative = await createOrder(ana.token, [{ dishId: arepa.id, quantity: -1 }]);
    assert.equal(negative.status, 400);

    const unavailable = await createOrder(ana.token, [{ dishId: agotado.id, quantity: 1 }]);
    assert.equal(unavailable.status, 400);

    const emptyAddress = await request(baseUrl)
      .post("/api/orders")
      .set("Authorization", `Bearer ${ana.token}`)
      .set("Idempotency-Key", newKey())
      .send({ items: [{ dishId: arepa.id, quantity: 1 }], address: { line1: "", city: "" } });
    assert.equal(emptyAddress.status, 400);
  });

  it("la misma Idempotency-Key devuelve el mismo pedido", async () => {
    const key = newKey();
    const first = await createOrder(ana.token, [{ dishId: arepa.id, quantity: 1 }], key);
    const second = await createOrder(ana.token, [{ dishId: arepa.id, quantity: 1 }], key);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.order.id, first.body.order.id);
    assert.equal(await models.Order.countDocuments(), 1);
  });

  it("un pedido ajeno responde 404, tanto al verlo como al capturarlo", async () => {
    const order = await orderOf(ana.token);
    const view = await request(baseUrl).get(`/api/orders/${order.id}`).set("Authorization", `Bearer ${beto.token}`);
    assert.equal(view.status, 404);
    const stolen = await capture(beto.token, order.id);
    assert.equal(stolen.status, 404);
  });

  it("el historial solo muestra los pedidos propios", async () => {
    await orderOf(ana.token);
    await orderOf(beto.token);
    const res = await request(baseUrl).get("/api/orders").set("Authorization", `Bearer ${ana.token}`);
    assert.equal(res.body.orders.length, 1);
  });
});

describe("pagos con PayPal", () => {
  it("GET /api/payments/config entrega el client ID y no expone el secreto", async () => {
    const res = await request(baseUrl).get("/api/payments/config");
    assert.equal(res.status, 200);
    assert.equal(res.body.clientId, "client-id-de-prueba");
    assert.equal(res.body.currency, "USD");
    assert.equal(JSON.stringify(res.body).includes("secreto-paypal-de-prueba"), false);
  });

  it("una captura verificada marca el pedido como pagado", async () => {
    const order = await orderOf(ana.token);
    const prepared = await request(baseUrl)
      .post(`/api/orders/${order.id}/paypal-order`)
      .set("Authorization", `Bearer ${ana.token}`);
    assert.equal(prepared.status, 200);
    assert.equal(prepared.body.paypalOrderId, order.paypalOrderId);

    const res = await capture(ana.token, order.id, prepared.body.paypalOrderId);
    assert.equal(res.status, 200);
    assert.equal(res.body.order.status, "PAID");
    assert.ok(res.body.order.paidAt);

    const payment = await models.Payment.findOne({ orderId: order.id });
    assert.equal(payment.status, "CAPTURED");
    assert.equal(payment.captureId, `CAP-${order.paypalOrderId}`);
  });

  it("una captura repetida no cobra dos veces ni crea otro pago", async () => {
    const order = await orderOf(ana.token);
    const first = await capture(ana.token, order.id);
    const second = await capture(ana.token, order.id);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.order.status, "PAID");
    assert.equal(paypal.captureCalls, 1);
    assert.equal(await models.Payment.countDocuments({ orderId: order.id }), 1);
  });

  // El paso CREATED a CAPTURE_PENDING depende de que findOneAndUpdate sea atómico,
  // algo que garantiza MongoDB real pero no todos los sustitutos de prueba.
  const atomicSkip = process.env.TEST_MONGODB_URI ? "requiere MongoDB real (TEST_MONGODB_URI no es atómico)" : false;

  it("dos capturas simultáneas producen una sola llamada de cobro", { skip: atomicSkip }, async () => {
    const order = await orderOf(ana.token);
    const [a, b] = await Promise.all([capture(ana.token, order.id), capture(ana.token, order.id)]);
    assert.ok([200, 409].includes(a.status));
    assert.ok([200, 409].includes(b.status));
    assert.equal(paypal.captureCalls, 1);
    const stored = await models.Order.findById(order.id);
    assert.equal(stored.status, "PAID");
  });

  it("si el importe de PayPal no coincide, el pedido no se marca como pagado", async () => {
    const order = await orderOf(ana.token);
    paypal.amountOverride = { currency_code: "USD", value: "0.01" };
    const res = await capture(ana.token, order.id);
    assert.equal(res.status, 402);
    const stored = await models.Order.findById(order.id);
    assert.equal(stored.status, "PENDING_PAYMENT");
    const payment = await models.Payment.findOne({ orderId: order.id });
    assert.equal(payment.status, "FAILED");
  });

  it("un pago rechazado deja el pedido sin pagar y permite reintentar sin duplicar", async () => {
    const order = await orderOf(ana.token);
    paypal.captureMode = "declined";
    const rejected = await capture(ana.token, order.id);
    assert.equal(rejected.status, 402);
    assert.equal((await models.Order.findById(order.id)).status, "PENDING_PAYMENT");

    paypal.captureMode = "ok";
    const retry = await capture(ana.token, order.id);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.order.status, "PAID");
    assert.equal(await models.Order.countDocuments(), 1);
  });

  it("un error de red de PayPal responde 502 y permite recuperarse", async () => {
    const order = await orderOf(ana.token);
    paypal.captureMode = "down";
    const failed = await capture(ana.token, order.id);
    assert.equal(failed.status, 502);
    assert.equal((await models.Order.findById(order.id)).status, "PENDING_PAYMENT");

    paypal.captureMode = "ok";
    const retry = await capture(ana.token, order.id);
    assert.equal(retry.status, 200);
  });

  it("rechaza capturar una orden de PayPal que no pertenece al pedido", async () => {
    const order = await orderOf(ana.token);
    const res = await capture(ana.token, order.id, "OTRA-ORDEN");
    assert.equal(res.status, 400);
    assert.equal(paypal.captureCalls, 0);
  });

  it("crea otra orden de PayPal si la anterior caducó, con el total ya guardado", async () => {
    const order = await orderOf(ana.token, [{ dishId: bandeja.id, quantity: 2 }]);
    paypal.orders.delete(order.paypalOrderId);
    const res = await request(baseUrl)
      .post(`/api/orders/${order.id}/paypal-order`)
      .set("Authorization", `Bearer ${ana.token}`);
    assert.equal(res.status, 200);
    assert.notEqual(res.body.paypalOrderId, order.paypalOrderId);
    const created = paypal.orders.get(res.body.paypalOrderId);
    assert.equal(created.purchase_units[0].amount.value, "28.00");
  });
});

describe("cocina y tiempo real", () => {
  async function paidOrder() {
    const order = await orderOf(ana.token);
    const res = await capture(ana.token, order.id);
    assert.equal(res.status, 200);
    return order;
  }

  function patch(id, status, token = cook.token) {
    return request(baseUrl)
      .patch(`/api/kitchen/orders/${id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status });
  }

  it("la cocina solo ve pedidos pagados", async () => {
    await orderOf(ana.token);
    const paid = await paidOrder();
    const res = await request(baseUrl).get("/api/kitchen/orders").set("Authorization", `Bearer ${cook.token}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.orders.map((order) => order.id), [paid.id]);
  });

  it("solo permite la transición siguiente y rechaza saltos con 409", async () => {
    const order = await paidOrder();
    assert.equal((await patch(order.id, "READY")).status, 409);
    assert.equal((await patch(order.id, "PREPARING")).status, 200);
    assert.equal((await patch(order.id, "DELIVERED")).status, 409);
    assert.equal((await patch(order.id, "READY")).status, 200);
    assert.equal((await patch(order.id, "DELIVERED")).status, 200);
    assert.equal((await patch(order.id, "DELIVERED")).status, 409);
  });

  it("un cliente no puede cambiar estados y un pedido sin pagar no existe para la cocina", async () => {
    const paid = await paidOrder();
    assert.equal((await patch(paid.id, "PREPARING", ana.token)).status, 403);
    const pending = await orderOf(beto.token);
    assert.equal((await patch(pending.id, "PREPARING")).status, 404);
  });

  it("el handshake sin token o con token inválido se rechaza", async () => {
    for (const auth of [{}, { token: "no-es-un-jwt" }]) {
      const socket = connectSocket(baseUrl, { auth, reconnection: false, transports: ["websocket"] });
      const error = await new Promise((resolve) => socket.on("connect_error", resolve));
      assert.equal(error.message, "UNAUTHORIZED");
      socket.close();
    }
  });

  it("el cocinero y el dueño reciben el evento y otro cliente no", async () => {
    const connect = (token) =>
      new Promise((resolve, reject) => {
        const socket = connectSocket(baseUrl, { auth: { token }, reconnection: false, transports: ["websocket"] });
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", reject);
      });

    const [owner, other, kitchen] = await Promise.all([connect(ana.token), connect(beto.token), connect(cook.token)]);
    const received = { owner: [], other: [], kitchen: [] };
    owner.on("order:status", (event) => received.owner.push(event));
    other.on("order:status", (event) => received.other.push(event));
    kitchen.on("order:status", (event) => received.kitchen.push(event));

    const order = await paidOrder();
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.equal(received.owner.length, 1);
    assert.equal(received.owner[0].orderId, order.id);
    assert.equal(received.owner[0].status, "PAID");
    assert.deepEqual(Object.keys(received.owner[0]).sort(), ["orderId", "status", "updatedAt"]);
    assert.equal(received.kitchen.length, 1);
    assert.equal(received.other.length, 0);

    [owner, other, kitchen].forEach((socket) => socket.close());
  });
});
