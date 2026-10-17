import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  UnsupportedProviderError,
} from "../../src/errors/payment.errors";
import { PaymentProviderFactory } from "../../src/factories/payment-provider.factory";
import { FakePaymentProvider } from "../fakes/fake-payment.provider";

describe("PaymentProviderFactory", () => {
  it("returns the provider registered under a name", () => {
    const stripe = new FakePaymentProvider("stripe");
    const factory = new PaymentProviderFactory([stripe]);

    expect(factory.get("stripe")).toBe(stripe);
  });

  it("normalises case and surrounding whitespace", () => {
    const stripe = new FakePaymentProvider("stripe");
    const factory = new PaymentProviderFactory([stripe]);

    expect(factory.get("  STRIPE ")).toBe(stripe);
    expect(factory.has("Stripe")).toBe(true);
  });

  it("lists names in registration order", () => {
    const factory = new PaymentProviderFactory([
      new FakePaymentProvider("sandbox"),
      new FakePaymentProvider("stripe"),
    ]);

    expect(factory.names()).toEqual(["sandbox", "stripe"]);
  });

  it("throws a 422 UnsupportedProviderError for unknown names", () => {
    const factory = new PaymentProviderFactory([
      new FakePaymentProvider("sandbox"),
      new FakePaymentProvider("stripe"),
    ]);

    try {
      factory.get("paypal");
      throw new Error("expected factory.get to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedProviderError);
      const unsupported = error as UnsupportedProviderError;
      expect(unsupported.code).toBe("unsupported_provider");
      expect(unsupported.httpStatus).toBe(422);
      expect(unsupported.supported).toEqual(["sandbox", "stripe"]);
    }
  });

  it("rejects duplicate registrations at boot", () => {
    expect(
      () =>
        new PaymentProviderFactory([
          new FakePaymentProvider("stripe"),
          new FakePaymentProvider("stripe"),
        ]),
    ).toThrow(ConfigurationError);
  });

  it("rejects an empty registry", () => {
    expect(() => new PaymentProviderFactory([])).toThrow(ConfigurationError);
  });

  it("rejects a provider without a name", () => {
    expect(() => new PaymentProviderFactory([new FakePaymentProvider("  ")])).toThrow(
      ConfigurationError,
    );
  });
});
