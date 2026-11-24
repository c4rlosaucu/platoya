# PlatoYa

Pedidos de un restaurante. Esta entrega cubre el registro de clientes, el inicio de sesión, el menú, el carrito y la creación del pedido. El total lo calcula el servidor. PayPal Sandbox, el tablero de cocina y el tiempo real quedan para la siguiente entrega: hoy `createPaypalOrder` solo reserva un identificador falso y el pedido permanece en pago pendiente.

Actores en el código: `customer` y `cook`. La interfaz está en español.

## Requisitos

- Node.js 20
- MongoDB Atlas, con la URI en `MONGODB_URI`

## Variables

En PowerShell:

```powershell
Copy-Item .env.example server/.env
Copy-Item .env.example web/.env.local
```

En bash:

```bash
cp .env.example server/.env
cp .env.example web/.env.local
```

Completa en `server/.env` la URI, un `JWT_SECRET` de al menos 16 caracteres y `CLIENT_ORIGIN=http://localhost:3000`. Borra de `web/.env.local` todo excepto:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
```

`server/.env` y `web/.env.local` no se versionan. Las claves de PayPal pueden quedar vacías hasta conectar Sandbox.

## Arranque local

```bash
cd server && npm install && npm run seed && npm run dev
cd web && npm install && npm run dev
```

La API escucha en `process.env.PORT` y en `0.0.0.0`. En local el puerto del ejemplo es `3001`. La web queda en `http://localhost:3000`. `GET /health` responde `{ ok: true, db }`.

Cuentas que crea el seed, solo para demostración:

- Cocinero: `cocinero@platoya.local` / `Cocina1234`
- Cliente: `cliente@platoya.local` / `Cliente1234`

El registro público siempre crea un `customer`, aunque el cuerpo pida otro rol.

## Producción local

```bash
cd server && npm start
cd web && npm run build && npm start
```

## Pendiente

PayPal real, captura del pago, WebSockets, panel de cocina, pruebas de integración y el despliegue en Railway.
