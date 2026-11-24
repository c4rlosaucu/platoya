export type Role = "customer" | "cook";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type Dish = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  available: boolean;
  imageUrl: string;
};

export type CartItem = {
  dishId: string;
  name: string;
  category: string;
  priceCents: number;
  quantity: number;
  imageUrl: string;
};

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "PREPARING" | "READY" | "DELIVERED";

export type OrderItem = {
  dishId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type Order = {
  id: string;
  items: OrderItem[];
  address: {
    line1: string;
    city: string;
    reference: string;
  };
  totalCents: number;
  currency: "USD";
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string; by: string }[];
  paypalOrderId: string;
  createdAt: string;
  paidAt: string | null;
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pago pendiente",
  PAID: "Recibido",
  PREPARING: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
};

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Cliente",
  cook: "Cocinero",
};
