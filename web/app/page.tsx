import { MenuBoard } from "@/components/MenuBoard";
import type { Dish } from "@/lib/types";

export default async function HomePage() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p>Falta NEXT_PUBLIC_API_URL en la web.</p>
      </main>
    );
  }

  try {
    const response = await fetch(`${base}/api/dishes`, { cache: "no-store" });
    if (!response.ok) throw new Error("menu");
    const data = (await response.json()) as { dishes: Dish[] };
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <MenuBoard dishes={data.dishes} />
      </main>
    );
  } catch {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="rounded-3xl border border-line bg-card p-6">No se pudo cargar el menú. Revisa que la API esté en marcha.</p>
      </main>
    );
  }
}
