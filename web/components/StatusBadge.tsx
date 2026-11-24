import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

const tones: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-gold",
  PAID: "bg-moss-soft text-moss",
  PREPARING: "bg-orange-100 text-clay-dark",
  READY: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
