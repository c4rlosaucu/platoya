"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatUsd } from "@/lib/format";

export default function CartPage() {
  const { items, ready, estimatedCents, setQuantity, remove, clear } = useCart();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-5xl">Carrito</h1>
      {!ready ? <p className="mt-6">Cargando carrito…</p> : null}
      {ready && items.length === 0 ? (
        <div className="mt-8 rounded-[1.75rem] border border-dashed border-line bg-card p-8">
          <p>El carrito está vacío.</p>
          <Link href="/" className="mt-4 inline-block font-semibold text-clay">
            Ver el menú
          </Link>
        </div>
      ) : null}
      {ready && items.length > 0 ? (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <article key={item.dishId} className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{item.category}</p>
                <h2 className="font-serif text-2xl">{item.name}</h2>
                <p className="text-sm text-stone-600">{formatUsd(item.priceCents)} cada uno</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium" htmlFor={`qty-${item.dishId}`}>
                  Cantidad
                </label>
                <input
                  id={`qty-${item.dishId}`}
                  className="w-20 rounded-2xl border border-line bg-paper px-3 py-2"
                  type="number"
                  min={1}
                  max={20}
                  value={item.quantity}
                  onChange={(event) => setQuantity(item.dishId, Number(event.target.value))}
                />
                <button type="button" className="text-sm font-semibold text-clay" onClick={() => remove(item.dishId)}>
                  Quitar
                </button>
              </div>
            </article>
          ))}
          <div className="flex flex-col items-start justify-between gap-4 rounded-[1.75rem] bg-ink px-5 py-5 text-paper sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-stone-300">Total estimado</p>
              <p className="font-serif text-4xl">{formatUsd(estimatedCents)}</p>
            </div>
            <Link href="/checkout" className="rounded-full bg-card px-5 py-3 text-sm font-semibold text-ink">
              Continuar con la dirección
            </Link>
          </div>
          <button type="button" className="text-sm font-semibold text-stone-600" onClick={clear}>
            Vaciar carrito
          </button>
        </div>
      ) : null}
    </main>
  );
}
