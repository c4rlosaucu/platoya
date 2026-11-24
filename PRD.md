# PRD de PlatoYa

## 1. Resumen del producto

PlatoYa es una aplicación web de pedidos para un restaurante. Un cliente consulta el menú, arma un carrito, confirma un pedido con su dirección de entrega y lo paga con PayPal (Sandbox). La cocina ve los pedidos pagados en un tablero y los avanza por estados. El cliente ve el cambio de estado en su pantalla al instante, sin recargar.

El backend es la fuente de verdad. Los precios, el total, la validación del pago y los cambios de estado se deciden en el servidor y nunca en el navegador.

## 2. Usuarios y roles

| Rol | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| Visitante | Sin sesión | Ver el menú, registrarse, iniciar sesión |
| Cliente (`customer`) | Registro público | Carrito, crear pedidos, pagar, ver solo sus pedidos |
| Cocinero (`cook`) | Lo crea el seed | Ver el tablero de cocina y avanzar el estado de pedidos pagados |

El registro público siempre crea un cliente, aunque la petición incluya otro rol.

Cuentas de demostración (solo para pruebas, creadas por el seed):
- Cliente: `cliente@platoya.local` con la clave `Cliente1234`
- Cocinero: `cocinero@platoya.local` con la clave `Cocina1234`

Para pagar se usa una cuenta de comprador de PayPal Sandbox, que se entrega aparte y no forma parte del repositorio.

## 3. Alcance

Dentro del alcance: autenticación, menú, carrito, pedidos, pago con PayPal Sandbox, tablero de cocina y actualización en tiempo real.

Fuera del alcance: inventario, cupones, propinas, múltiples restaurantes, panel de administración, correos de notificación, reembolsos, pagos reales.

## 4. Requisitos funcionales y criterios de aceptación

### RF1. Registro e inicio de sesión
- Un visitante puede registrarse con nombre, correo y clave. La clave se guarda con hash bcrypt.
- Un correo repetido es rechazado con un mensaje claro.
- Un usuario puede iniciar sesión con correo y clave correctos y queda identificado en la barra superior.
- Con clave incorrecta se muestra un error sin revelar si el correo existe.
- Tras 10 intentos de autenticación en un minuto, el servidor responde con límite de intentos.
- Un cliente que inicia sesión va al menú. Un cocinero va a `/cocina`.
- "Salir" cierra la sesión y las páginas protegidas piden iniciar sesión de nuevo.

### RF2. Menú
- Cualquier visitante ve la lista de platos con nombre, descripción, imagen y precio en USD.
- Cada plato tiene un botón para agregarlo al carrito.

### RF3. Carrito
- El cliente puede agregar platos, subir o bajar cantidades y quitar platos.
- El carrito muestra el subtotal por plato y el total.
- El carrito se conserva al recargar la página.
- Un carrito vacío no permite continuar al pago.

### RF4. Creación del pedido
- El cliente escribe dirección y ciudad. Ambas son obligatorias.
- Al confirmar se crea un pedido en estado `PENDING_PAYMENT`.
- El total lo recalcula el servidor con los precios de la base de datos. Cualquier precio enviado por el navegador se ignora.
- Repetir la misma petición con la misma `Idempotency-Key` no crea un pedido duplicado.
- El pedido queda visible en `/pedidos` con la etiqueta "Pago pendiente".

### RF5. Pago con PayPal Sandbox
- La pantalla de pago muestra el resumen y el botón de PayPal.
- Al aprobar el pago en PayPal, el servidor captura la orden y verifica estado COMPLETED, moneda, importe y que corresponda a ese pedido.
- Si todo coincide, el pedido pasa a `PAID` y la pantalla muestra "Pago recibido".
- Si el pago no coincide o no está aprobado, el pedido sigue sin pagar y se muestra un error.
- Si el cliente cancela en PayPal, el pedido sigue en "Pago pendiente" y puede pagarlo después desde `/pedidos`.
- Capturar dos veces el mismo pedido no cobra dos veces.
- Un pedido sin pagar nunca aparece en el tablero de cocina.

### RF6. Historial y detalle de pedidos
- El cliente ve solo sus pedidos, del más nuevo al más antiguo.
- El detalle muestra platos, cantidades, total, dirección y el historial de estados con fecha y hora.
- Abrir el pedido de otro usuario responde como si no existiera (404).

### RF7. Tablero de cocina
- Solo el cocinero accede a `/cocina`. Un cliente ve "Acceso denegado". Un visitante ve un enlace para iniciar sesión con la cuenta de cocina.
- El tablero tiene cuatro columnas: Pendiente, En preparación, Listo y Entregado.
- Cada pedido pagado aparece en su columna con platos, dirección, total y un único botón con la acción siguiente.
- El flujo permitido es `PAID` a `PREPARING` a `READY` a `DELIVERED`. No se puede saltar ni retroceder una etapa.

### RF8. Tiempo real
- Cuando la cocina cambia un estado, el cliente dueño del pedido ve el nuevo estado sin recargar.
- Cuando un pedido se paga, aparece en el tablero de cocina sin recargar.
- Un cliente no recibe eventos de pedidos ajenos.
- La conexión exige un token de sesión válido. Sin token, la conexión es rechazada.
- Si la conexión se pierde y vuelve, la pantalla se sincroniza.
- El tablero muestra si el tiempo real está conectado.

## 5. Autorización

| Acción | Visitante | Cliente | Cocinero |
|---|---|---|---|
| Ver menú | Sí | Sí | Sí |
| Crear, ver y pagar pedidos propios | No | Sí | No |
| Ver pedidos ajenos | No | No | No |
| Ver y avanzar pedidos de cocina | No | No | Sí |

Respuestas esperadas: 401 sin sesión, 403 con rol incorrecto, 404 en recursos ajenos, 409 en transición ilegal.

## 6. Requisitos no funcionales
- Seguridad: clave con bcrypt, JWT firmado, CORS limitado al origen del frontend, cabeceras de Helmet, validación de entrada con Zod y claves del servidor solo en variables de entorno.
- Integridad del dinero: importes en centavos enteros y verificación de cada pago contra PayPal.
- Errores uniformes con la forma `{ error: { code, message } }`.
- Idioma de la interfaz: español. Moneda: USD.
- Diseño adaptable a pantalla de escritorio y de móvil.

## 7. Datos principales
- `users`: nombre, correo único, hash de clave, rol.
- `dishes`: nombre, descripción, categoría, imagen, precio en centavos, disponibilidad.
- `orders`: usuario, platos con precio congelado, dirección, total en centavos, moneda, estado, historial de estados, clave de idempotencia, id de orden de PayPal.
- `payments`: pedido, id de orden de PayPal, estado (CREATED, CAPTURE_PENDING, CAPTURED, FAILED), importe y moneda verificados.

## 8. Plan de pruebas sugerido

Áreas para el plan de TestSprite y las pruebas manuales:
1. Registro e inicio de sesión (clave válida, clave incorrecta, correo repetido, cierre de sesión).
2. Control de acceso por rol (cliente en `/cocina`, visitante en `/cocina`, pedido ajeno).
3. Menú y carrito (agregar, cambiar cantidad, quitar, persistencia, carrito vacío).
4. Creación de pedido (dirección obligatoria, total calculado por el servidor, sin duplicados).
5. Pago (botón visible, pago pendiente al cancelar, reintento desde el historial). El pago completo en PayPal requiere la cuenta Sandbox y se verifica con evidencia manual.
6. Tablero de cocina (columnas, un solo botón por tarjeta, avance en orden).
7. Tiempo real (cambio de estado visible para el cliente sin recargar, con dos sesiones).

## 9. Criterios de salida de la entrega
- Todas las rutas protegidas respetan la matriz de autorización.
- Un pedido solo pasa a pagado tras la verificación del servidor con PayPal.
- Ningún secreto está en el repositorio ni en el frontend.
- Los fallos que queden abiertos se documentan con su severidad en el informe de resultados.
