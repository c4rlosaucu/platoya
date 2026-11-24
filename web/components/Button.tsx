import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full bg-clay px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
