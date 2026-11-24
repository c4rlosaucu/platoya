export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type ApiOptions = RequestInit & { token?: string | null };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new ApiError("Falta NEXT_PUBLIC_API_URL", "CONFIG", 0);
  }

  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(`${base}${path}`, { ...options, headers, cache: "no-store" });
  const data = (await response.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || "No se pudo completar la solicitud",
      data?.error?.code || "INTERNAL",
      response.status,
    );
  }

  return data as T;
}
