"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatUsd, formatWhen } from "@/lib/format";
import { useOrderEvents } from "@/lib/socket";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const { user, token, ready } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const isCustomer = user?.role === "customer";

  const load = useCallback(() => {
    if (!token) return;
    api<{ orders: Order[] }>("/api/orders", { token })
      .then((data) => setOrders(data.orders))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "No se pudieron cargar los pedidos"));
  }, [token]);

  useEffect(() => {
    if (ready && isCustomer) load();
  }, [ready, isCustomer, load]);

  // Cuando la cocina cambia un estado, el historial se actualiza sin recargar.
  useOrderEvents(isCustomer ? token : null, load);

  if (!ready) return <main className="px-4 py-16">Cargando…</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">Tus pedidos</h1>
        <Link href="/login?next=/pedidos" className="mt-6 inline-block font-semibold text-clay">
          Entra para verlos
        </Link>
      </main>
    );
  }
  if (!isCustomer) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-serif text-5xl">Historial de clientes</h1>
        <p className="mt-4">Esta cuenta de cocina no tiene pedidos propios.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-5xl">Pedidos</h1>
      {error ? <p className="mt-6 text-clay-dark">{error}</p> : null}
      {!error && orders.length === 0 ? <p className="mt-6">Todavía no has confirmado un pedido.</p> : null}
      <div className="mt-8 space-y-4">
        {orders.map((order) => (
          <Link key={order.id} href={`/pedidos/${order.id}`} className="block rounded-[1.75rem] border border-line bg-card p-5 hover:border-clay">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-serif text-2xl">{formatUsd(order.totalCents)}</p>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-2 text-sm text-stone-600">{formatWhen(order.createdAt)}</p>
            <p className="mt-2 text-sm">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
