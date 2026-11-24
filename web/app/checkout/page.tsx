"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field, TextArea } from "@/components/Field";
import { PaypalButton } from "@/components/PaypalButton";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatUsd } from "@/lib/format";
import type { Order } from "@/lib/types";

const IDEMPOTENCY_KEY = "platoya.idempotency";

/** Paso 1: dirección y creación del pedido. El servidor recalcula el total. */
function DeliveryStep() {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const { items, estimatedCents, clear } = useCart();
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [reference, setReference] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login?next=/checkout");
  }, [ready, router, user]);

  useEffect(() => {
    const stored = sessionStorage.getItem(IDEMPOTENCY_KEY);
    if (stored) {
      setIdempotencyKey(stored);
      return;
    }
    const next = crypto.randomUUID();
    sessionStorage.setItem(IDEMPOTENCY_KEY, next);
    setIdempotencyKey(next);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !idempotencyKey) return;
    setPending(true);
    setError("");
    try {
      const data = await api<{ order: Order }>("/api/orders", {
        method: "POST",
        token,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          items: items.map((item) => ({ dishId: item.dishId, quantity: item.quantity })),
          address: { line1, city, reference },
        }),
      });
      clear();
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      router.replace(`/checkout?pedido=${data.order.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo crear el pedido");
    } finally {
      setPending(false);
    }
  }

  if (!ready || !user) return <main className="px-4 py-16">Cargando…</main>;

  if (user.role !== "customer") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">Los pedidos los crea un cliente</h1>
        <p className="mt-4 text-stone-700">Esta cuenta es de cocina. Entra con un cliente para confirmar un pedido.</p>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">No hay nada que confirmar</h1>
        <Link href="/" className="mt-6 inline-block font-semibold text-clay">
          Volver al menú
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <h1 className="font-serif text-5xl">Entrega</h1>
        <Field label="Dirección" name="line1" required minLength={4} value={line1} onChange={(event) => setLine1(event.target.value)} />
        <Field label="Ciudad" name="city" required minLength={2} value={city} onChange={(event) => setCity(event.target.value)} />
        <TextArea label="Referencia (opcional)" name="reference" rows={3} value={reference} onChange={(event) => setReference(event.target.value)} />
        <p className="text-sm text-stone-700">
          Al confirmar, el servidor calcula el total con los precios vigentes y te lleva a pagar con PayPal Sandbox.
        </p>
        {error ? <p className="text-sm font-medium text-clay-dark">{error}</p> : null}
        <Button type="submit" disabled={pending || !idempotencyKey}>
          {pending ? "Confirmando…" : "Confirmar y pagar"}
        </Button>
      </form>
      <aside className="h-fit space-y-4 rounded-[1.75rem] border border-line bg-card p-5">
        <h2 className="font-serif text-3xl">Resumen</h2>
        <ul className="space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.dishId} className="flex justify-between gap-4">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{formatUsd(item.priceCents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line pt-4">
          <span>Total estimado</span>
          <strong>{formatUsd(estimatedCents)}</strong>
        </div>
      </aside>
    </main>
  );
}

/** Paso 2: pago con PayPal. También sirve para reintentar un pedido que quedó pendiente. */
function PaymentStep({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(`/checkout?pedido=${orderId}`)}`);
  }, [orderId, ready, router, user]);

  useEffect(() => {
    if (!ready || !token || user?.role !== "customer") return;
    api<{ order: Order }>(`/api/orders/${orderId}`, { token })
      .then((data) => {
        if (data.order.status !== "PENDING_PAYMENT") {
          router.replace(`/pedidos/${orderId}`);
          return;
        }
        setOrder(data.order);
      })
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "No se pudo cargar el pedido"));
  }, [orderId, ready, router, token, user]);

  const onPaid = useCallback(() => router.push(`/pedidos/${orderId}?pago=ok`), [orderId, router]);

  if (!ready || !user) return <main className="px-4 py-16">Cargando…</main>;

  if (user.role !== "customer") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">Los pagos los hace un cliente</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4">
        <h1 className="font-serif text-5xl">Pago</h1>
        <p className="text-sm text-stone-700">
          Paga con PayPal Sandbox. El pedido solo queda pagado cuando el servidor captura el pago y lo verifica con PayPal.
        </p>
        {error ? <p className="text-sm font-medium text-clay-dark">{error}</p> : null}
        {message ? <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-medium text-gold">{message}</p> : null}
        {order && token ? (
          <div className="max-w-sm">
            <PaypalButton orderId={order.id} token={token} onPaid={onPaid} onMessage={setMessage} />
          </div>
        ) : null}
        <Link href="/pedidos" className="inline-block text-sm font-semibold text-clay">
          Pagar más tarde
        </Link>
      </section>
      <aside className="h-fit space-y-4 rounded-[1.75rem] border border-line bg-card p-5">
        <h2 className="font-serif text-3xl">Resumen</h2>
        {order ? (
          <>
            <ul className="space-y-3 text-sm">
              {order.items.map((item) => (
                <li key={item.dishId} className="flex justify-between gap-4">
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span>{formatUsd(item.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line pt-4">
              <span>Total confirmado</span>
              <strong>{formatUsd(order.totalCents)}</strong>
            </div>
            <p className="text-sm text-stone-600">
              {order.address.line1}, {order.address.city}
            </p>
          </>
        ) : (
          <p className="text-sm text-stone-600">Cargando pedido…</p>
        )}
      </aside>
    </main>
  );
}

function CheckoutSteps() {
  const orderId = useSearchParams().get("pedido");
  return orderId ? <PaymentStep orderId={orderId} /> : <DeliveryStep />;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main className="px-4 py-16">Cargando…</main>}>
      <CheckoutSteps />
    </Suspense>
  );
}
