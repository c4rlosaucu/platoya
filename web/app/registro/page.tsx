"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await register(name, email, password);
      router.push("/");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo crear la cuenta");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Cuenta de cliente</p>
      <h1 className="mt-2 font-serif text-5xl">Crear cuenta</h1>
      <p className="mt-3 text-sm text-stone-700">El registro público crea una cuenta de cliente. La cocina entra con la cuenta de demostración.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Nombre" name="name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
        <Field label="Correo" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="text-sm font-medium text-clay-dark">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creando…" : "Crear cuenta"}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-clay">
          Entrar
        </Link>
      </p>
    </main>
  );
}
