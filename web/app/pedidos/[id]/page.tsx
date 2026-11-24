"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatUsd, formatWhen } from "@/lib/format";
import { useOrderEvents } from "@/lib/socket";
import { STATUS_LABELS, type Order, type OrderStatus } from "@/lib/types";

const STATUS_NOTES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "El pago sigue pendiente hasta que el servidor verifique PayPal.",
  PAID: "Recibimos tu pago. La cocina ya tiene tu pedido.",
  PREPARING: "La cocina está preparando tu pedido.",
  READY: "Tu pedido está listo.",
  DELIVERED: "Pedido entregado. Que lo disfrutes.",
};

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const justPaid = useSearchParams().get("pago") === "ok";
  const { user, token, ready } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const isCustomer = user?.role === "customer";

  const load = useCallback(() => {
    if (!token || !params.id) return;
    api<{ order: Order }>(`/api/orders/${params.id}`, { token })
      .then((data) => setOrder(data.order))
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "No se pudo cargar el pedido"));
  }, [params.id, token]);

  useEffect(() => {
    if (ready && isCustomer) load();
  }, [ready, isCustomer, load]);

  // El estado cambia en vivo cuando la cocina lo actualiza.
  useOrderEvents(isCustomer ? token : null, load);

  if (!ready) return <main className="px-4 py-16">Cargando…</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Link href={`/login?next=/pedidos/${params.id}`} className="font-semibold text-clay">
          Entra para ver el pedido
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/pedidos" className="text-sm font-semibold text-clay">
        Volver al historial
      </Link>
      {error ? <p className="mt-6 text-clay-dark">{error}</p> : null}
      {order ? (
        <article className="mt-4 space-y-6">
          {justPaid && order.status !== "PENDING_PAYMENT" ? (
            <p className="rounded-2xl bg-moss-soft px-4 py-3 text-sm font-semibold text-moss">
              Pago recibido. El servidor verificó PayPal y tu pedido ya está en la cocina.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="font-serif text-5xl">Pedido</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-stone-600">
            Confirmado el {formatWhen(order.createdAt)}. {STATUS_NOTES[order.status]}
          </p>
          {order.status === "PENDING_PAYMENT" ? (
            <Link
              href={`/checkout?pedido=${order.id}`}
              className="inline-flex rounded-full bg-clay px-5 py-2.5 text-sm font-semibold text-white hover:bg-clay-dark"
            >
              Pagar con PayPal
            </Link>
          ) : null}
          <ul className="divide-y divide-line rounded-[1.75rem] border border-line bg-card">
            {order.items.map((item) => (
              <li key={item.dishId} className="flex items-center justify-between gap-4 px-5 py-4">
                <span>
                  {item.quantity} × {item.name}
                  <span className="block text-sm text-stone-500">{formatUsd(item.unitPriceCents)} c/u</span>
                </span>
                <strong>{formatUsd(item.lineTotalCents)}</strong>
              </li>
            ))}
            <li className="flex items-center justify-between px-5 py-4">
              <span>Total confirmado</span>
              <strong className="font-serif text-3xl">{formatUsd(order.totalCents)}</strong>
            </li>
          </ul>
          <section className="rounded-[1.75rem] bg-moss px-5 py-5 text-white">
            <h2 className="font-serif text-3xl">Entrega</h2>
            <p className="mt-2">{order.address.line1}</p>
            <p>{order.address.city}</p>
            {order.address.reference ? <p className="mt-2 text-sm text-emerald-100">{order.address.reference}</p> : null}
          </section>
          <section>
            <h2 className="font-serif text-3xl">Estados</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {order.statusHistory.map((entry) => (
                <li key={`${entry.status}-${entry.at}`}>
                  {STATUS_LABELS[entry.status]} · {formatWhen(entry.at)}
                </li>
              ))}
            </ol>
          </section>
        </article>
      ) : null}
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<main className="px-4 py-16">Cargando…</main>}>
      <OrderDetail />
    </Suspense>
  );
}
