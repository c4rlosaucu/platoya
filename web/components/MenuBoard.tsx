"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { useCart } from "@/lib/cart";
import { formatUsd } from "@/lib/format";
import type { Dish } from "@/lib/types";

const categoryOrder = ["Entradas", "Principales", "Bebidas", "Postres"];

function DishImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className="flex aspect-[4/3] items-end bg-moss p-4">
        <span className="font-serif text-3xl text-white">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="aspect-[4/3] w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function MenuBoard({ dishes }: { dishes: Dish[] }) {
  const { addDish, items } = useCart();
  const categories = [
    ...categoryOrder.filter((category) => dishes.some((dish) => dish.category === category)),
    ...new Set(dishes.map((dish) => dish.category).filter((category) => !categoryOrder.includes(category))),
  ];

  return (
    <div className="space-y-12">
      <section className="grid gap-6 md:grid-cols-[1.4fr_0.8fr] md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clay">Cocina de hoy</p>
          <h1 className="mt-3 max-w-xl font-serif text-5xl leading-none sm:text-6xl">El menú sale cuando tú lo pides.</h1>
        </div>
        <p className="max-w-sm text-stone-700">
          Precios en USD. El carrito guarda una estimación; el total del pedido lo calcula el servidor con el precio vigente.
        </p>
      </section>

      {dishes.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-card p-8">Todavía no hay platos disponibles.</p>
      ) : null}

      {categories.map((category) => (
        <section key={category} className="space-y-4">
          <h2 className="font-serif text-3xl">{category}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dishes
              .filter((dish) => dish.category === category)
              .map((dish) => {
                const inCart = items.find((item) => item.dishId === dish.id);
                return (
                  <article key={dish.id} className="overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-sm">
                    <DishImage src={dish.imageUrl} alt={dish.name} />
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-serif text-2xl leading-tight">{dish.name}</h3>
                        <p className="shrink-0 font-semibold">{formatUsd(dish.priceCents)}</p>
                      </div>
                      <p className="min-h-12 text-sm text-stone-700">{dish.description}</p>
                      <div className="flex items-center justify-between gap-3">
                        <Button type="button" onClick={() => addDish(dish)}>
                          Agregar
                        </Button>
                        {inCart ? <span className="text-sm text-moss">En el carrito · {inCart.quantity}</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
