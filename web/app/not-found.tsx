import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20">
      <h1 className="font-serif text-5xl">Esa página no está</h1>
      <Link href="/" className="mt-6 inline-block font-semibold text-clay">
        Volver al menú
      </Link>
    </main>
  );
}
