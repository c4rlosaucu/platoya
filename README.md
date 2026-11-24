# PlatoYa

Aplicación web de pedidos de un restaurante, generada con ayuda de IA (Cursor y Claude) para el laboratorio de Fundamentos de Sistemas de la Universidad de Antioquia.

Actores en el código: `customer` (cliente) y `cook` (cocinero). La interfaz está en español y los precios en USD.

## Qué hace

- Registro e inicio de sesión. El registro público siempre crea un cliente. El cocinero lo crea el seed.
- Menú con categorías, carrito y dirección de entrega.
- El servidor recalcula el total con los precios de la base de datos. El navegador nunca decide el precio.
- Pago con PayPal Sandbox. El pedido solo queda pagado cuando el servidor captura el pago y verifica estado, moneda, importe e identificador del pedido.
- Historial de pedidos del cliente, que se actualiza en vivo.
- Tablero de cocina con columnas Pendiente, En preparación, Listo y Entregado, actualizado en tiempo real con WebSockets.

## Arquitectura

```
Navegador ──HTTPS──> Next.js (web)
Navegador ──HTTPS/REST + WSS──> Express + Socket.IO (server) ──> MongoDB Atlas
                                           └──> PayPal Sandbox
```

- `web`: Next.js (App Router), TypeScript y Tailwind. Solo interfaz. No tiene rutas de API.
- `server`: Node.js, Express, Mongoose y Socket.IO en un solo proceso. Toda la lógica de autenticación, pagos y estados vive aquí.
- Dos paquetes independientes, sin workspaces, para que Railway construya cada servicio desde su carpeta.

## Requisitos

- Node.js 20 o superior
- Una base en MongoDB Atlas
- Una app de PayPal Sandbox (Client ID y Secret)

## Variables de entorno

```powershell
Copy-Item .env.example server/.env
Copy-Item .env.example web/.env.local
```

En `server/.env` completa `MONGODB_URI`, `JWT_SECRET` (largo y aleatorio), `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`. En `web/.env.local` deja solo:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
```

`server/.env` y `web/.env.local` no se versionan. El Secret de PayPal y la URI existen solo en el backend. `NEXT_PUBLIC_API_URL` es la única variable pública.

## Arranque local

```bash
cd server && npm install && npm run seed && npm run dev
cd web && npm install && npm run dev
```

La API escucha en `PORT` (3001 en el ejemplo) y en `0.0.0.0`. La web queda en `http://localhost:3000`. `GET /health` responde `{ ok: true, db }`.

Cuentas de demostración que crea el seed:

- Cocinero: `cocinero@platoya.local` / `Cocina1234`
- Cliente: `cliente@platoya.local` / `Cliente1234`

Para pagar en Sandbox se usa una cuenta de comprador de PayPal Sandbox (Developer Dashboard, Testing Tools, Sandbox Accounts).

## Pruebas

```bash
cd server && npm test
```

Las pruebas de integración usan MongoDB en memoria y un PayPal simulado por HTTP. No llaman a Atlas ni a PayPal. Cubren login, roles, propiedad de pedidos, recálculo de precios, captura correcta y repetida, importes que no coinciden, pagos rechazados, transiciones de estado y WebSockets autenticados.

## Modelo de datos

- `users`: name, email único, passwordHash (bcrypt), role (`customer` o `cook`), createdAt.
- `dishes`: name, description, category, priceCents, available, imageUrl.
- `orders`: userId, items (con copia del precio), address, totalCents, currency, status, statusHistory, paypalOrderId, idempotencyKey, paidAt, timestamps.
- `payments`: orderId, paypalOrderId, captureId, status (`CREATED`, `CAPTURE_PENDING`, `CAPTURED`, `FAILED`), amountCents, currency, paypalStatus, timestamps. No se guardan datos de tarjeta.

Estados del pedido: `PENDING_PAYMENT` → `PAID` → `PREPARING` → `READY` → `DELIVERED`. No hay saltos ni retrocesos.

## API y autorización

| Método y ruta | Quién | Propósito |
|---|---|---|
| `GET /health` | Público | Estado del servicio |
| `POST /api/auth/register` | Público | Crea un cliente (ignora cualquier rol enviado) |
| `POST /api/auth/login` | Público | Inicia sesión (límite de intentos) |
| `GET /api/auth/me` | Sesión | Perfil |
| `GET /api/dishes`, `GET /api/dishes/:id` | Público | Menú |
| `GET /api/payments/config` | Público | Client ID público de PayPal y moneda |
| `POST /api/orders` | Cliente | Crea el pedido (exige `Idempotency-Key`) |
| `GET /api/orders`, `GET /api/orders/:id` | Cliente dueño | Historial y detalle (un pedido ajeno responde 404) |
| `POST /api/orders/:id/paypal-order` | Cliente dueño | Entrega la orden de PayPal, o crea otra si caducó |
| `POST /api/orders/:id/capture` | Cliente dueño | Captura, verifica y marca como pagado |
| `GET /api/kitchen/orders` | Cocinero | Pedidos pagados y últimos entregados |
| `PATCH /api/kitchen/orders/:id/status` | Cocinero | Solo la transición siguiente |

Códigos: 400 validación, 401 sin sesión, 402 pago que no coincide o no aprobado, 403 rol incorrecto, 404 inexistente o ajeno, 409 transición ilegal o captura en curso, 502 PayPal no disponible.

## Tiempo real

Socket.IO usa el mismo proceso Express. El handshake exige el JWT. Cada conexión entra en la sala `user:{id}` y el cocinero también en `kitchen`. El evento `order:status` lleva solo `{ orderId, status, updatedAt }` y la pantalla vuelve a pedir los datos por REST. Al reconectarse, la pantalla se sincroniza.

## Producción local

```bash
cd server && npm start
cd web && npm run build && npm start
```

## Despliegue en Railway

Dos servicios desde el mismo repositorio:

- `server`: carpeta raíz `server`, healthcheck `/health`. Variables: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN` (URL pública exacta de la web), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`, `PAYPAL_CURRENCY`.
- `web`: carpeta raíz `web`. Variable `NEXT_PUBLIC_API_URL` con la URL pública del backend. Debe estar definida durante el build.

En MongoDB Atlas hay que permitir la conexión desde Railway (Network Access).

## Fuera del MVP

CRUD de platos, subida de imágenes, recuperación de contraseña, anulación y reembolso, impuestos, varios restaurantes, inventario y arrastrar tarjetas en el Kanban.
