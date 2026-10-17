export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";

export type PaymentRecord = {
  provider: string;
  transactionId: string;
  status: "succeeded" | "pending" | "failed";
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  refundedCents: number;
  createdAt: Date;
};

export type Order = {
  id: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  payment?: PaymentRecord;
  createdAt: Date;
};

export function refundableCents(order: Order): number {
  if (!order.payment) return 0;
  return Math.max(0, order.payment.amountCents - order.payment.refundedCents);
}
