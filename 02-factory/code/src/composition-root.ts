import Razorpay from "razorpay";
import Stripe from "stripe";
import { loadConfig, type Config } from "./config/env";
import { ConfigurationError } from "./errors/payment.errors";
import { PaymentProviderFactory } from "./factories/payment-provider.factory";
import { createLogger, type Logger } from "./lib/logger";
import { MetricsRegistry } from "./lib/metrics";
import type { Order } from "./models/order.model";
import type { PaymentProvider } from "./providers/payment-provider";
import type { ProviderInfo } from "./providers/provider-info";
import { RazorpayProvider, type RazorpayClient } from "./providers/razorpay-payment.provider";
import { RetryingPaymentProvider } from "./providers/retrying-payment.provider";
import { SandboxPaymentProvider } from "./providers/sandbox-payment.provider";
import { StripeProvider } from "./providers/stripe-payment.provider";
import { InMemoryOrderRepository } from "./repositories/in-memory-order.repository";
import type { OrderRepository } from "./repositories/order.repository";
import { PaymentService } from "./services/payment.service";
import { ProviderSelectionPolicy } from "./services/provider-selection.policy";

export type PaymentModule = {
  payments: PaymentService;
  factory: PaymentProviderFactory;
  policy: ProviderSelectionPolicy;
  metrics: MetricsRegistry;
  providerInfo: ProviderInfo;
};

export type Container = PaymentModule & {
  config: Config;
  orders: OrderRepository;
  logger: Logger;
  shutdown: () => Promise<void>;
};

type ModuleDependencies = {
  orders: OrderRepository;
  providers: readonly PaymentProvider[];
  metrics?: MetricsRegistry;
  logger?: Logger;
};

/**
 * Build the object graph for payments. Exported so tests can inject fakes
 * without booting the server or reading environment variables.
 */
export function createPaymentModule(
  config: Config,
  deps: ModuleDependencies,
): PaymentModule {
  const metrics = deps.metrics ?? new MetricsRegistry();
  const logger = deps.logger ?? createLogger(config.logLevel);
  const factory = new PaymentProviderFactory(deps.providers);
  const policy = new ProviderSelectionPolicy(
    config.enabledProviders,
    config.defaultProvider,
    config.currencyDefaults,
  );

  const payments = new PaymentService({
    providers: factory,
    policy,
    orders: deps.orders,
    metrics,
    logger,
  });

  return {
    payments,
    factory,
    policy,
    metrics,
    providerInfo: {
      registered: factory.names(),
      enabled: config.enabledProviders,
      defaultProvider: config.defaultProvider,
      currencyDefaults: config.currencyDefaults,
      maxRetries: config.paymentMaxRetries,
    },
  };
}

type BuiltProviders = {
  providers: PaymentProvider[];
  sandbox?: SandboxPaymentProvider;
};

/**
 * The only function that names concrete provider classes or reads secrets.
 * It runs once, at boot.
 */
function buildProviders(config: Config, logger: Logger): BuiltProviders {
  let sandbox: SandboxPaymentProvider | undefined;

  const providers = config.enabledProviders.map<PaymentProvider>((name) => {
    switch (name) {
      case "sandbox": {
        sandbox = new SandboxPaymentProvider({
          latencyMs: config.sandboxLatencyMs,
          seed: config.sandboxSeed,
        });
        return sandbox;
      }

      case "stripe": {
        const client = new Stripe(config.stripeSecretKey!, {
          timeout: config.paymentTimeoutMs,
          maxNetworkRetries: 0,
          telemetry: false,
        });
        return new StripeProvider(client);
      }

      case "razorpay": {
        const client = new Razorpay({
          key_id: config.razorpayKeyId!,
          key_secret: config.razorpayKeySecret!,
        });
        return new RazorpayProvider(client as unknown as RazorpayClient);
      }

      default:
        throw new ConfigurationError(`Unhandled payment provider: ${String(name)}`);
    }
  });

  return {
    providers: providers.map((provider) =>
      config.paymentMaxRetries > 0
        ? new RetryingPaymentProvider(provider, {
            maxRetries: config.paymentMaxRetries,
            baseDelayMs: config.paymentRetryBaseDelayMs,
            logger,
          })
        : provider,
    ),
    sandbox,
  };
}

function demoOrders(sandbox?: SandboxPaymentProvider): Order[] {
  const orders: Order[] = [
    {
      id: "ord_demo_inr",
      userId: "usr_1",
      totalCents: 1_999,
      currency: "INR",
      status: "pending",
      createdAt: new Date("2026-01-05T10:00:00Z"),
    },
    {
      id: "ord_demo_usd",
      userId: "usr_1",
      totalCents: 4_500,
      currency: "USD",
      status: "pending",
      createdAt: new Date("2026-01-04T09:30:00Z"),
    },
    {
      id: "ord_demo_declined",
      userId: "usr_2",
      totalCents: 999,
      currency: "INR",
      status: "pending",
      createdAt: new Date("2026-01-03T08:15:00Z"),
    },
    {
      id: "ord_demo_flaky",
      userId: "usr_2",
      totalCents: 2_500,
      currency: "INR",
      status: "pending",
      createdAt: new Date("2026-01-02T16:45:00Z"),
    },
  ];

  if (sandbox) {
    const idempotencyKey = "order:ord_demo_paid:pay:v1";
    const charge = sandbox.seedCharge({
      orderId: "ord_demo_paid",
      amountCents: 899,
      currency: "INR",
      idempotencyKey,
    });

    orders.push({
      id: "ord_demo_paid",
      userId: "usr_1",
      totalCents: 899,
      currency: "INR",
      status: "paid",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      payment: {
        provider: sandbox.name,
        transactionId: charge.transactionId,
        status: "succeeded",
        amountCents: 899,
        currency: "INR",
        idempotencyKey,
        refundedCents: 0,
        createdAt: new Date("2026-01-01T12:01:00Z"),
      },
    });
  }

  return orders;
}

/**
 * Composition root for the running application.
 * This is the only place that reads env, constructs SDK clients, and seeds data.
 */
export function createContainer(config: Config = loadConfig()): Container {
  const logger = createLogger(config.logLevel);
  const orders = new InMemoryOrderRepository();
  const { providers, sandbox } = buildProviders(config, logger);

  if (config.seedDemo) {
    orders.seed(...demoOrders(sandbox));
  }

  return {
    config,
    ...createPaymentModule(config, { orders, providers, logger }),
    orders,
    logger,
    shutdown: async () => {},
  };
}
