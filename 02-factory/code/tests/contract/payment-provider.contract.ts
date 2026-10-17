import { describe, expect, it } from "vitest";
import type { PaymentProvider, PaymentRequest } from "../../src/providers/payment-provider";

let sequence = 0;

function contractRequest(orderId: string, amountCents = 500): PaymentRequest {
  sequence += 1;
  return {
    orderId,
    amountCents,
    currency: "INR",
    idempotencyKey: `contract:${orderId}:${sequence}`,
  };
}

/**
 * Semantics every provider must satisfy. Run it against the sandbox and the
 * fake; run it against a real vendor only in a dedicated sandbox environment.
 */
export function describePaymentProviderContract(
  label: string,
  createProvider: () => PaymentProvider,
): void {
  describe(`PaymentProvider contract: ${label}`, () => {
    it("exposes a stable lowercase name", () => {
      expect(createProvider().name).toMatch(/^[a-z][a-z0-9_-]{1,30}$/);
    });

    it("returns a transaction id and a known status", async () => {
      const result = await createProvider().charge(contractRequest("ord_contract_1"));

      expect(result.transactionId).toBeTruthy();
      expect(["succeeded", "pending", "failed"]).toContain(result.status);
    });

    it("is idempotent for a repeated idempotency key", async () => {
      const provider = createProvider();
      const request = contractRequest("ord_contract_2");

      const first = await provider.charge(request);
      const second = await provider.charge(request);

      expect(second.transactionId).toBe(first.transactionId);
    });

    it("rejects a refund larger than the captured amount", async () => {
      const provider = createProvider();
      const { transactionId } = await provider.charge(
        contractRequest("ord_contract_3", 500),
      );

      await expect(provider.refund(transactionId, 501)).rejects.toBeInstanceOf(
        Error,
      );
    });

    it("allows partial refunds up to the captured amount", async () => {
      const provider = createProvider();
      const { transactionId } = await provider.charge(
        contractRequest("ord_contract_4", 500),
      );

      await expect(provider.refund(transactionId, 200)).resolves.toMatchObject({
        amountCents: 200,
      });
      await expect(provider.refund(transactionId, 200)).resolves.toMatchObject({
        amountCents: 200,
      });
      await expect(provider.refund(transactionId, 101)).rejects.toBeInstanceOf(
        Error,
      );
    });

    it("rejects a refund for an unknown transaction", async () => {
      const provider = createProvider();

      await expect(
        provider.refund("tx_does_not_exist", 100),
      ).rejects.toBeInstanceOf(Error);
    });
  });
}
