"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const TOKEN_KEY = "platoya.token";

type AuthResponse = { token: string; user: User };

type AuthContextValue = {
  user: User | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function persistSession(token: string, user: User, setToken: (value: string | null) => void, setUser: (value: User | null) => void) {
  localStorage.setItem(TOKEN_KEY, token);
  setToken(token);
  setUser(user);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setReady(true);
      return;
    }

    api<{ user: User }>("/api/auth/me", { token: stored })
      .then((data) => {
        setToken(stored);
        setUser(data.user);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      ready,
      async login(email, password) {
        const data = await api<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        persistSession(data.token, data.user, setToken, setUser);
        return data.user;
      },
      async register(name, email, password) {
        const data = await api<AuthResponse>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        persistSession(data.token, data.user, setToken, setUser);
        return data.user;
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [ready, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
