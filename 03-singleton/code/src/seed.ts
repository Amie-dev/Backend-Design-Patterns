import { orderTotalCents, type Order, type OrderItem } from "./models/order.model";

function isoBefore(now: Date, offsetMs: number): string {
  return new Date(now.getTime() - offsetMs).toISOString();
}

function makeOrder(
  input: Omit<Order, "totalCents"> & { items: OrderItem[] },
): Order {
  return {
    ...input,
    totalCents: orderTotalCents(input.items),
  };
}

/**
 * Two tenants are seeded so the demo can prove request-scoped isolation:
 * `tenant_demo` sees two orders, `tenant_other` sees one, and neither can
 * read the other's order by id.
 */
export function seedOrders(now: Date): Order[] {
  return [
    makeOrder({
      id: "ord_demo_usd",
      tenantId: "tenant_demo",
      userId: "usr_demo",
      items: [
        { sku: "sku_keyboard", quantity: 1, unitPriceCents: 12_999 },
        { sku: "sku_mouse", quantity: 1, unitPriceCents: 4_999 },
      ],
      currency: "USD",
      status: "pending",
      createdAt: isoBefore(now, 60_000),
      updatedAt: isoBefore(now, 60_000),
    }),
    makeOrder({
      id: "ord_demo_inr",
      tenantId: "tenant_demo",
      userId: "usr_demo",
      items: [{ sku: "sku_cable", quantity: 2, unitPriceCents: 24_950 }],
      currency: "INR",
      status: "pending",
      createdAt: isoBefore(now, 120_000),
      updatedAt: isoBefore(now, 120_000),
    }),
    makeOrder({
      id: "ord_demo_other",
      tenantId: "tenant_other",
      userId: "usr_other",
      items: [{ sku: "sku_monitor", quantity: 1, unitPriceCents: 24_900 }],
      currency: "USD",
      status: "pending",
      createdAt: isoBefore(now, 180_000),
      updatedAt: isoBefore(now, 180_000),
    }),
  ];
}
