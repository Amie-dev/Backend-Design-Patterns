/**
 * The product contract every payment provider must implement.
 *
 * Rules:
 * - No vendor SDK types, Express types, or Prisma types are allowed here.
 * - Money is always an integer in the smallest currency unit (cents/paise).
 * - `idempotencyKey` is required: a retried charge must never create a second
 *   payment at the vendor.
 */

export const PROVIDER_NAMES = ["sandbox", "stripe", "razorpay"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export type PaymentStatus = "succeeded" | "pending" | "failed";

export type PaymentRequest = {
  orderId: string;
  amountCents: number;
  currency: string; // ISO-4217, uppercase
  idempotencyKey: string;
};

export type PaymentResult = {
  transactionId: string;
  status: PaymentStatus;
};

export type RefundResult = {
  refundId: string;
  amountCents: number;
  status: "succeeded" | "pending";
};

export interface PaymentProvider {
  readonly name: string;
  charge(input: PaymentRequest): Promise<PaymentResult>;
  refund(transactionId: string, amountCents: number): Promise<RefundResult>;
}

export function isProviderName(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value);
}
