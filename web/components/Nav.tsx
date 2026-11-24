"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { ROLE_LABELS } from "@/lib/types";

export function Nav() {
  const { user, ready, logout } = useAuth();
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-serif text-3xl tracking-tight">
          PlatoYa
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-semibold">
          <Link href="/" className="hover:text-clay">
            Menú
          </Link>
          <Link href="/carrito" className="hover:text-clay">
            Carrito{count > 0 ? ` (${count})` : ""}
          </Link>
          {ready && user?.role === "customer" ? (
            <Link href="/pedidos" className="hover:text-clay">
              Pedidos
            </Link>
          ) : null}
          {ready && user ? (
            <>
              <span className="text-stone-600">
                {user.name} · {ROLE_LABELS[user.role]}
              </span>
              <button type="button" onClick={logout} className="hover:text-clay">
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-clay">
                Entrar
              </Link>
              <Link href="/registro" className="rounded-full bg-ink px-3 py-1.5 text-paper">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
