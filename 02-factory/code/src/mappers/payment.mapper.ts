import type { PaymentStatus } from "../providers/payment-provider";
import type { RefundResult } from "../providers/payment-provider";

/**
 * Vendor status vocabularies translated into the three domain statuses.
 * Keeping this mapping in one file makes it testable without SDK objects.
 */

export function fromStripeStatus(status: string): PaymentStatus {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "processing":
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "requires_capture":
      return "pending";
    default:
      return "failed";
  }
}

export function fromRazorpayStatus(status: string): PaymentStatus {
  switch (status) {
    case "paid":
    case "captured":
      return "succeeded";
    case "created":
    case "attempted":
    case "authorized":
      return "pending";
    default:
      return "failed";
  }
}

export function fromStripeRefundStatus(
  status: string,
): RefundResult["status"] | "failed" {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "pending":
    case "requires_action":
      return "pending";
    default:
      return "failed";
  }
}
