import { ConfigurationError, UnsupportedProviderError } from "../errors/payment.errors";
import type { PaymentProvider } from "../providers/payment-provider";

/**
 * Registry factory: maps a provider name to an already-constructed instance.
 *
 * - No vendor SDKs, no env access, no behaviour.
 * - Duplicate and empty registries fail at boot, not at request time.
 * - Unknown names throw a typed 422 instead of returning `undefined`.
 */
export class PaymentProviderFactory {
  private readonly registry: ReadonlyMap<string, PaymentProvider>;

  constructor(providers: readonly PaymentProvider[]) {
    if (providers.length === 0) {
      throw new ConfigurationError("At least one payment provider must be registered");
    }

    const registry = new Map<string, PaymentProvider>();

    for (const provider of providers) {
      const name = provider.name?.trim().toLowerCase();

      if (!name) {
        throw new ConfigurationError("Payment provider name is required");
      }
      if (registry.has(name)) {
        throw new ConfigurationError(`Duplicate payment provider: ${name}`);
      }

      registry.set(name, provider);
    }

    this.registry = registry;
  }

  get(name: string): PaymentProvider {
    const normalized = name.trim().toLowerCase();
    const provider = this.registry.get(normalized);

    if (!provider) {
      throw new UnsupportedProviderError(normalized, this.names());
    }

    return provider;
  }

  has(name: string): boolean {
    return this.registry.has(name.trim().toLowerCase());
  }

  names(): string[] {
    return [...this.registry.keys()];
  }
}
