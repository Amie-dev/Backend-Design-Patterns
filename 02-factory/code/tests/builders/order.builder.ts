import type { Order, PaymentRecord } from "../../src/models/order.model";

const createdAt = new Date("2026-01-05T10:00:00Z");

export function aPayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    provider: "sandbox",
    transactionId: "tx_paid_1",
    status: "succeeded",
    amountCents: 1_999,
    currency: "INR",
    idempotencyKey: "order:ord_1:pay:v1",
    refundedCents: 0,
    createdAt,
    ...overrides,
  };
}

export function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_1",
    userId: "usr_1",
    totalCents: 1_999,
    currency: "INR",
    status: "pending",
    createdAt,
    ...overrides,
  };
}

type PaidOrderOverrides = Partial<Omit<Order, "payment">> & {
  payment?: Partial<PaymentRecord>;
};

export function aPaidOrder(overrides: PaidOrderOverrides = {}): Order {
  return {
    ...anOrder({ status: "paid" }),
    ...overrides,
    payment: aPayment(overrides.payment),
  };
}
