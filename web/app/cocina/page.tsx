"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatUsd, formatWhen } from "@/lib/format";
import { useOrderEvents } from "@/lib/socket";
import type { Order, OrderStatus } from "@/lib/types";

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: "PAID", title: "Pendiente" },
  { status: "PREPARING", title: "En preparación" },
  { status: "READY", title: "Listo" },
  { status: "DELIVERED", title: "Entregado" },
];

// Una sola transición permitida por tarjeta. DELIVERED no tiene botón.
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  PAID: { status: "PREPARING", label: "Empezar a preparar" },
  PREPARING: { status: "READY", label: "Marcar listo" },
  READY: { status: "DELIVERED", label: "Marcar entregado" },
};

export default function KitchenPage() {
  const { user, token, ready } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const isCook = user?.role === "cook";

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api<{ orders: Order[] }>("/api/kitchen/orders", { token });
      setOrders(data.orders);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo cargar el tablero");
    }
  }, [token]);

  useEffect(() => {
    if (ready && isCook) load();
  }, [ready, isCook, load]);

  const { connected } = useOrderEvents(isCook ? token : null, load);

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!token || !next) return;
    setBusyId(order.id);
    try {
      await api(`/api/kitchen/orders/${order.id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: next.status }),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo cambiar el estado");
      await load();
    } finally {
      setBusyId("");
    }
  }

  if (!ready) return <main className="px-4 py-16">Cargando…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">Cocina</h1>
        <Link href="/login?next=/cocina" className="mt-6 inline-block font-semibold text-clay">
          Entra con la cuenta de cocina
        </Link>
      </main>
    );
  }

  if (!isCook) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">Acceso denegado</h1>
        <p className="mt-4 text-stone-700">El tablero de cocina es solo para cocineros.</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-clay">
          Volver al menú
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-5xl">Cocina</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-gold"
          }`}
        >
          {connected ? "Tiempo real conectado" : "Reconectando…"}
        </span>
      </div>
      {error ? <p className="mt-4 text-sm font-medium text-clay-dark">{error}</p> : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnOrders = orders.filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="rounded-[1.75rem] border border-line bg-card/60 p-4">
              <h2 className="flex items-center justify-between font-serif text-2xl">
                {column.title}
                <span className="rounded-full bg-paper px-2.5 py-0.5 font-sans text-sm font-semibold">
                  {columnOrders.length}
                </span>
              </h2>
              <div className="mt-4 space-y-3">
                {columnOrders.length === 0 ? <p className="text-sm text-stone-500">Sin pedidos</p> : null}
                {columnOrders.map((order) => {
                  const next = NEXT[order.status];
                  return (
                    <article key={order.id} className="space-y-3 rounded-2xl border border-line bg-card p-4">
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span className="font-semibold">#{order.id.slice(-6).toUpperCase()}</span>
                        <span>{formatWhen(order.paidAt ?? order.createdAt)}</span>
                      </div>
                      <ul className="space-y-1 text-sm">
                        {order.items.map((item) => (
                          <li key={item.dishId}>
                            {item.quantity} × {item.name}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-stone-700">
                        {order.address.line1}, {order.address.city}
                        {order.address.reference ? ` · ${order.address.reference}` : ""}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <strong>{formatUsd(order.totalCents)}</strong>
                        {next ? (
                          <Button type="button" disabled={busyId === order.id} onClick={() => advance(order)}>
                            {next.label}
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
