import type { Order } from "../../src/models/order.model";

let sequence = 0;

export function anOrder(overrides: Partial<Order> = {}): Order {
  sequence += 1;

  return {
    id: `ord_test_${sequence}`,
    userId: "usr_test",
    totalCents: 1999,
    status: "pending",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function resetOrderSequence(): void {
  sequence = 0;
}
