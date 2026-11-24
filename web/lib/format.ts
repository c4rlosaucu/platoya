export function formatUsd(cents: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatWhen(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
