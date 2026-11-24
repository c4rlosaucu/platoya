"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field, TextArea } from "@/components/Field";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatUsd } from "@/lib/format";
import type { Order } from "@/lib/types";

const IDEMPOTENCY_KEY = "platoya.idempotency";

export default function CheckoutPage() {
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
      router.push(`/pedidos/${data.order.id}`);
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
          Al confirmar, el pedido queda en pago pendiente. El botón de PayPal Sandbox se conecta en la siguiente entrega; hoy el servidor solo reserva un cobro falso y no marca el pedido como pagado.
        </p>
        {error ? <p className="text-sm font-medium text-clay-dark">{error}</p> : null}
        <Button type="submit" disabled={pending || !idempotencyKey}>
          {pending ? "Confirmando…" : "Confirmar pedido"}
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
