import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none ring-clay focus:ring-2";

export function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id || props.name;
  return (
    <label className="block space-y-2 text-sm font-medium" htmlFor={id}>
      <span>{label}</span>
      <input id={id} className={control} {...props} />
    </label>
  );
}

export function TextArea({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id || props.name;
  return (
    <label className="block space-y-2 text-sm font-medium" htmlFor={id}>
      <span>{label}</span>
      <textarea id={id} className={control} {...props} />
    </label>
  );
}
