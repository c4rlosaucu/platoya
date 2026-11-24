"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { CartItem, Dish } from "@/lib/types";

const CART_KEY = "platoya.cart";
const OWNER_KEY = "platoya.cart.owner";

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  estimatedCents: number;
  addDish: (dish: Dish) => void;
  setQuantity: (dishId: string, quantity: number) => void;
  remove: (dishId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return (
    typeof item.dishId === "string" &&
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    Number.isInteger(item.priceCents) &&
    Number.isInteger(item.quantity) &&
    (item.quantity ?? 0) >= 1 &&
    (item.quantity ?? 0) <= 20 &&
    typeof item.imageUrl === "string"
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const { user, ready: authReady } = useAuth();

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]") as unknown;
      setItems(Array.isArray(parsed) ? parsed.filter(isCartItem) : []);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, []);

  // El carrito es de una persona. Si la sesión se cierra, expira o entra otra cuenta,
  // se vacía para que la siguiente persona no vea platos ajenos.
  // Un carrito de visitante (sin dueño) lo adopta quien inicia sesión para poder pagar.
  useEffect(() => {
    if (!ready || !authReady) return;
    try {
      const owner = localStorage.getItem(OWNER_KEY);
      if (user) {
        if (owner && owner !== user.id) setItems([]);
        localStorage.setItem(OWNER_KEY, user.id);
      } else if (owner) {
        setItems([]);
        localStorage.removeItem(OWNER_KEY);
      }
    } catch {
      // Si el almacenamiento no está disponible, el carrito solo vive en memoria.
    }
  }, [user, ready, authReady]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    return {
      items,
      ready,
      count,
      estimatedCents,
      addDish(dish) {
        setItems((current) => {
          const found = current.find((item) => item.dishId === dish.id);
          if (!found) {
            return [
              ...current,
              {
                dishId: dish.id,
                name: dish.name,
                category: dish.category,
                priceCents: dish.priceCents,
                quantity: 1,
                imageUrl: dish.imageUrl,
              },
            ];
          }
          return current.map((item) =>
            item.dishId === dish.id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item,
          );
        });
      },
      setQuantity(dishId, quantity) {
        setItems((current) =>
          current.flatMap((item) => {
            if (item.dishId !== dishId) return [item];
            if (quantity < 1) return [];
            return [{ ...item, quantity: Math.min(20, quantity) }];
          }),
        );
      },
      remove(dishId) {
        setItems((current) => current.filter((item) => item.dishId !== dishId));
      },
      clear() {
        setItems([]);
      },
    };
  }, [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
