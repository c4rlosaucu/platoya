"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(email, password);
      router.push(safeNext(params.get("next")));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "No se pudo entrar");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-clay">Acceso</p>
      <h1 className="mt-2 font-serif text-5xl">Entrar</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Correo" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="text-sm font-medium text-clay-dark">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-clay">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="px-4 py-16">Cargando…</main>}>
      <LoginForm />
    </Suspense>
  );
}
