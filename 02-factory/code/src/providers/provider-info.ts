export type ProviderInfo = {
  registered: string[];
  enabled: string[];
  defaultProvider: string;
  currencyDefaults: Record<string, string>;
  maxRetries: number;
};
