import {
  ConfigurationError,
  UnsupportedProviderError,
} from "../errors/payment.errors";

export type ProviderSelectionInput = {
  requested?: string;
  currency: string;
};

/**
 * Business policy: which provider should serve this order?
 *
 * Precedence:
 *   1. explicit request (validated against the enabled allow-list)
 *   2. currency default
 *   3. configured default provider
 *
 * The policy is pure and synchronous; the factory is a separate registry.
 */
export class ProviderSelectionPolicy {
  constructor(
    readonly enabled: readonly string[],
    readonly defaultProvider: string,
    readonly byCurrency: Readonly<Record<string, string>> = {},
  ) {
    if (enabled.length === 0) {
      throw new ConfigurationError("At least one payment provider must be enabled");
    }
    if (!enabled.includes(defaultProvider)) {
      throw new ConfigurationError(
        `Default provider is not enabled: ${defaultProvider}`,
      );
    }

    for (const [currency, provider] of Object.entries(byCurrency)) {
      if (!enabled.includes(provider)) {
        throw new ConfigurationError(
          `Currency ${currency} maps to a disabled provider: ${provider}`,
        );
      }
    }
  }

  resolve(input: ProviderSelectionInput): string {
    const requested = input.requested?.trim().toLowerCase();

    if (requested) {
      if (!this.enabled.includes(requested)) {
        throw new UnsupportedProviderError(requested, this.enabled);
      }
      return requested;
    }

    const currencyDefault = this.byCurrency[input.currency.toUpperCase()];
    const selected = currencyDefault ?? this.defaultProvider;

    if (!this.enabled.includes(selected)) {
      throw new ConfigurationError(`Selected provider is not enabled: ${selected}`);
    }

    return selected;
  }
}
