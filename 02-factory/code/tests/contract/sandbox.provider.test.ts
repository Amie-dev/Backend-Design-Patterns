import { describePaymentProviderContract } from "./payment-provider.contract";
import { SandboxPaymentProvider } from "../../src/providers/sandbox-payment.provider";

describePaymentProviderContract(
  "sandbox",
  () => new SandboxPaymentProvider({ latencyMs: 0, seed: 7 }),
);
