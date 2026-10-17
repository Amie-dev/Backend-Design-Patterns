export type OrderStatus = "pending" | "cancelled";

export type OrderItem = {
  sku: string;
  quantity: number;
  unitPriceCents: number;
};

export type Order = {
  id: string;
  tenantId: string;
  userId: string;
  items: OrderItem[];
  totalCents: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

/** The server computes totals; client-supplied totals are never trusted. */
export function orderTotalCents(items: readonly OrderItem[]): number {
  return items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
}
