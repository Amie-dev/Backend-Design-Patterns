import { randomUUID } from "node:crypto";
import {
  InvalidOrderError,
  OrderNotFoundError,
  OrderNotPendingError,
} from "../errors/app.errors";
import type { TtlCache } from "../infrastructure/cache";
import type { Logger } from "../lib/logger";
import type { MetricsRegistry } from "../lib/metrics";
import { getRequestContext } from "../lib/request-context";
import {
  orderTotalCents,
  type Order,
  type OrderItem,
} from "../models/order.model";
import type { OrderRepository } from "../repositories/order.repository";

export type CreateOrderInput = {
  items: OrderItem[];
  currency: string;
};

export type OrderActor = {
  tenantId: string;
  userId: string;
};

export type OrderServiceDependencies = {
  orders: OrderRepository;
  cache: TtlCache;
  metrics: MetricsRegistry;
  logger: Logger;
  clock?: () => Date;
  idFactory?: () => string;
};

/**
 * Business rules. The service holds no request state: tenant and user ids
 * arrive as arguments, while logs read the request context for correlation.
 */
export class OrderService {
  private readonly clock: () => Date;
  private readonly idFactory: () => string;

  constructor(private readonly deps: OrderServiceDependencies) {
    this.clock = deps.clock ?? (() => new Date());
    this.idFactory =
      deps.idFactory ?? (() => `ord_${randomUUID().slice(0, 8)}`);
  }

  async list(tenantId: string): Promise<Order[]> {
    const key = listKey(tenantId);
    const cached = this.readCache<Order[]>("list", key);
    if (cached !== undefined) return cached;

    const orders = await this.deps.orders.listByTenant(tenantId);
    this.deps.cache.set(key, orders);
    return orders;
  }

  async getById(orderId: string, tenantId: string): Promise<Order> {
    const key = itemKey(tenantId, orderId);
    const cached = this.readCache<Order>("get", key);
    if (cached !== undefined) return cached;

    const order = await this.deps.orders.findById(orderId, tenantId);
    if (!order) throw new OrderNotFoundError(orderId);

    this.deps.cache.set(key, order);
    return order;
  }

  async create(input: CreateOrderInput, actor: OrderActor): Promise<Order> {
    if (input.items.length === 0) {
      throw new InvalidOrderError("An order needs at least one item");
    }

    const totalCents = orderTotalCents(input.items);
    if (totalCents <= 0) {
      throw new InvalidOrderError("Order total must be positive");
    }

    const timestamp = this.clock().toISOString();
    const order: Order = {
      id: this.idFactory(),
      tenantId: actor.tenantId,
      userId: actor.userId,
      items: input.items.map((item) => ({ ...item })),
      totalCents,
      currency: input.currency,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.deps.orders.save(order);
    this.invalidate(actor.tenantId, order.id, "create");

    this.deps.metrics.increment("orders_created_total", {
      tenant: actor.tenantId,
    });
    this.deps.logger.info("order created", {
      ...this.requestFields(),
      orderId: order.id,
      totalCents,
      currency: order.currency,
    });

    return order;
  }

  async cancel(orderId: string, tenantId: string): Promise<Order> {
    // Read fresh from the repository: a cached copy could be stale when two
    // requests race to cancel the same order.
    const order = await this.deps.orders.findById(orderId, tenantId);
    if (!order) throw new OrderNotFoundError(orderId);
    if (order.status !== "pending") {
      throw new OrderNotPendingError(orderId, order.status);
    }

    const updated: Order = {
      ...order,
      status: "cancelled",
      updatedAt: this.clock().toISOString(),
    };

    await this.deps.orders.save(updated);
    this.invalidate(tenantId, orderId, "cancel");

    this.deps.metrics.increment("orders_cancelled_total", {
      tenant: tenantId,
    });
    this.deps.logger.info("order cancelled", {
      ...this.requestFields(),
      orderId,
    });

    return updated;
  }

  private readCache<T>(
    operation: "list" | "get",
    key: string,
  ): T | undefined {
    const value = this.deps.cache.get<T>(key);
    this.deps.metrics.increment("cache_events_total", {
      operation,
      result: value === undefined ? "miss" : "hit",
    });
    return value;
  }

  private invalidate(tenantId: string, orderId: string, reason: string): void {
    this.deps.cache.delete(itemKey(tenantId, orderId));
    this.deps.cache.delete(listKey(tenantId));
    this.deps.metrics.increment("cache_invalidations_total", { reason });
  }

  private requestFields() {
    const context = getRequestContext();
    return context
      ? {
          requestId: context.requestId,
          tenantId: context.tenantId,
          userId: context.userId,
        }
      : {};
  }
}

function listKey(tenantId: string): string {
  return `orders:${tenantId}:list:v1`;
}

function itemKey(tenantId: string, orderId: string): string {
  return `orders:${tenantId}:item:${orderId}:v1`;
}
