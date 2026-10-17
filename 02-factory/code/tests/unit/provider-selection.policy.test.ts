import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  UnsupportedProviderError,
} from "../../src/errors/payment.errors";
import { ProviderSelectionPolicy } from "../../src/services/provider-selection.policy";

describe("ProviderSelectionPolicy", () => {
  const policy = new ProviderSelectionPolicy(["sandbox", "stripe"], "sandbox", {
    USD: "stripe",
  });

  it.each([
    [{ requested: "stripe", currency: "INR" }, "stripe"],
    [{ requested: " STRIPE ", currency: "INR" }, "stripe"],
    [{ currency: "INR" }, "sandbox"],
    [{ currency: "USD" }, "stripe"],
    [{ currency: "usd" }, "stripe"],
    [{ requested: "sandbox", currency: "USD" }, "sandbox"],
  ])("resolves %o to %s", (input, expected) => {
    expect(policy.resolve(input)).toBe(expected);
  });

  it("rejects a provider that is not enabled", () => {
    try {
      policy.resolve({ requested: "paypal", currency: "INR" });
      throw new Error("expected resolve to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedProviderError);
      expect((error as UnsupportedProviderError).supported).toEqual([
        "sandbox",
        "stripe",
      ]);
    }
  });

  it("rejects a default provider that is not enabled", () => {
    expect(
      () => new ProviderSelectionPolicy(["sandbox"], "stripe"),
    ).toThrow(ConfigurationError);
  });

  it("rejects a currency mapped to a disabled provider", () => {
    expect(
      () => new ProviderSelectionPolicy(["sandbox"], "sandbox", { USD: "stripe" }),
    ).toThrow(ConfigurationError);
  });

  it("rejects an empty enabled list", () => {
    expect(() => new ProviderSelectionPolicy([], "sandbox")).toThrow(
      ConfigurationError,
    );
  });
});
