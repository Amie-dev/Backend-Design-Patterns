import type { Order, PaymentRecord } from "../models/order.model";

export type PaymentResponse = {
  provider: string;
  transactionId: string;
  status: PaymentRecord["status"];
  amountCents: number;
  currency: string;
  refundedCents: number;
  refundableCents: number;
  createdAt: string;
};

export type OrderResponse = {
  id: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: Order["status"];
  payment: PaymentResponse | null;
  createdAt: string;
};

export function toPaymentResponse(payment: PaymentRecord): PaymentResponse {
  return {
    provider: payment.provider,
    transactionId: payment.transactionId,
    status: payment.status,
    amountCents: payment.amountCents,
    currency: payment.currency,
    refundedCents: payment.refundedCents,
    refundableCents: Math.max(0, payment.amountCents - payment.refundedCents),
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toOrderResponse(order: Order): OrderResponse {
  return {
    id: order.id,
    userId: order.userId,
    totalCents: order.totalCents,
    currency: order.currency,
    status: order.status,
    payment: order.payment ? toPaymentResponse(order.payment) : null,
    createdAt: order.createdAt.toISOString(),
  };
}
