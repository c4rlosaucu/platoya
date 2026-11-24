import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: {
    default: "PlatoYa",
    template: "%s · PlatoYa",
  },
  description: "Pedidos de restaurante para clientes y cocina.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${outfit.className} ${fraunces.variable} min-h-screen antialiased`}>
        <Providers>
          <Nav />
          {children}
          <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-stone-600">
            PlatoYa · un restaurante, precios en USD, total confirmado por el servidor.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
