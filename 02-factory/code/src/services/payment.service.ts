import {
  AppError,
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentNotFoundError,
  PaymentDeclinedError,
  RefundExceedsPaymentError,
  UnsupportedProviderError,
} from "../errors/payment.errors";
import type { PaymentProviderFactory } from "../factories/payment-provider.factory";
import type { Logger } from "../lib/logger";
import type { MetricsRegistry } from "../lib/metrics";
import {
  refundableCents,
  type Order,
  type PaymentRecord,
} from "../models/order.model";
import type { PaymentProvider, PaymentStatus } from "../providers/payment-provider";
import type { OrderRepository } from "../repositories/order.repository";
import type { ProviderSelectionPolicy } from "./provider-selection.policy";

export type PayOrderResult = {
  orderId: string;
  provider: string;
  transactionId: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
};

export type RefundOrderResult = {
  orderId: string;
  provider: string;
  refundId: string;
  status: "succeeded" | "pending";
  amountCents: number;
  refundedCents: number;
  refundableCents: number;
};

type PaymentServiceDeps = {
  providers: PaymentProviderFactory;
  policy: ProviderSelectionPolicy;
  orders: OrderRepository;
  metrics: MetricsRegistry;
  logger: Logger;
};

/**
 * Use case: pay and refund orders.
 *
 * The service knows the policy, the factory, and the product interface.
 * It never imports a vendor SDK or a concrete provider class.
 */
export class PaymentService {
  private readonly providers: PaymentProviderFactory;
  private readonly policy: ProviderSelectionPolicy;
  private readonly orders: OrderRepository;
  private readonly metrics: MetricsRegistry;
  private readonly logger: Logger;

  constructor(deps: PaymentServiceDeps) {
    this.providers = deps.providers;
    this.policy = deps.policy;
    this.orders = deps.orders;
    this.metrics = deps.metrics;
    this.logger = deps.logger;
  }

  async listOrders(): Promise<Order[]> {
    return this.orders.list();
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.requireOrder(orderId);
  }

  async getPayment(orderId: string): Promise<PaymentRecord> {
    const order = await this.requireOrder(orderId);

    if (!order.payment) {
      throw new PaymentNotFoundError(orderId);
    }

    return order.payment;
  }

  async pay(orderId: string, requestedProvider?: string): Promise<PayOrderResult> {
    const order = await this.requireOrder(orderId);

    if (order.status !== "pending") {
      throw new OrderNotPayableError(
        order.id,
        order.status,
        order.payment?.transactionId,
      );
    }

    const provider = this.selectProvider(requestedProvider, order.currency);
    const idempotencyKey = `order:${order.id}:pay:v1`;
    const startedAt = performance.now();

    try {
      const result = await provider.charge({
        orderId: order.id,
        amountCents: order.totalCents,
        currency: order.currency,
        idempotencyKey,
      });

      this.recordChargeMetrics(provider, result.status, startedAt);
      this.logger.info("payment charged", {
        orderId: order.id,
        provider: provider.name,
        transactionId: result.transactionId,
        status: result.status,
        durationMs: Math.round(performance.now() - startedAt),
      });

      if (result.status !== "failed") {
        order.payment = {
          provider: provider.name,
          transactionId: result.transactionId,
          status: result.status,
          amountCents: order.totalCents,
          currency: order.currency,
          idempotencyKey,
          refundedCents: 0,
          createdAt: new Date(),
        };

        if (result.status === "succeeded") {
          order.status = "paid";
        }

        await this.orders.save(order);
      }

      return {
        orderId: order.id,
        provider: provider.name,
        transactionId: result.transactionId,
        status: result.status,
        amountCents: order.totalCents,
        currency: order.currency,
      };
    } catch (error) {
      const status = error instanceof PaymentDeclinedError ? "declined" : "error";
      this.recordChargeMetrics(provider, status, startedAt);
      this.logger.warn("payment charge failed", {
        orderId: order.id,
        provider: provider.name,
        code: error instanceof AppError ? error.code : "internal_error",
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  }

  async refund(orderId: string, requestedCents?: number): Promise<RefundOrderResult> {
    const order = await this.requireOrder(orderId);
    const payment = order.payment;

    if (!payment || payment.status !== "succeeded") {
      throw new PaymentNotFoundError(orderId);
    }

    const remaining = refundableCents(order);
    const amountCents = requestedCents ?? remaining;

    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0 ||
      amountCents > remaining
    ) {
      throw new RefundExceedsPaymentError(orderId, amountCents, remaining);
    }

    // The provider comes from the payment record, not from the request:
    // refunds must go back to the vendor that captured the money.
    const provider = this.providers.get(payment.provider);

    try {
      const result = await provider.refund(payment.transactionId, amountCents);

      if (result.status === "succeeded") {
        payment.refundedCents += amountCents;
        order.payment = payment;

        if (payment.refundedCents >= payment.amountCents) {
          order.status = "refunded";
        }

        await this.orders.save(order);
      }

      this.metrics.increment("payment_refund_total", {
        provider: provider.name,
        status: result.status,
      });
      this.logger.info("payment refunded", {
        orderId: order.id,
        provider: provider.name,
        refundId: result.refundId,
        amountCents,
      });

      return {
        orderId: order.id,
        provider: provider.name,
        refundId: result.refundId,
        status: result.status,
        amountCents,
        refundedCents: payment.refundedCents,
        refundableCents: Math.max(0, payment.amountCents - payment.refundedCents),
      };
    } catch (error) {
      this.metrics.increment("payment_refund_total", {
        provider: provider.name,
        status: "error",
      });
      throw error;
    }
  }

  private selectProvider(requested: string | undefined, currency: string): PaymentProvider {
    try {
      const name = this.policy.resolve({ requested, currency });
      return this.providers.get(name);
    } catch (error) {
      if (error instanceof UnsupportedProviderError) {
        this.metrics.increment("payment_provider_unknown_total", {
          requested: error.requested,
        });
      }
      throw error;
    }
  }

  private recordChargeMetrics(
    provider: PaymentProvider,
    status: string,
    startedAt: number,
  ): void {
    this.metrics.increment("payment_charge_total", {
      provider: provider.name,
      status,
    });
    this.metrics.observe(
      "payment_charge_duration_seconds",
      (performance.now() - startedAt) / 1000,
      { provider: provider.name },
    );
  }

  private async requireOrder(orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId);

    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    return order;
  }
}
