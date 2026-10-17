import type { DatabasePool } from "../infrastructure/database";
import type { Order } from "../models/order.model";
import type { OrderRepository } from "./order.repository";

/**
 * Adapter for the simulated database. The shared pool is injected; this
 * class never constructs one. The table itself is process-local, just like
 * an in-memory adapter, and is replaced by PostgreSQL/Prisma in production.
 */
export class PooledOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  constructor(private readonly pool: DatabasePool) {}

  async findById(id: string, tenantId: string): Promise<Order | null> {
    return this.pool.query(() => {
      const order = this.orders.get(id);
      return order && order.tenantId === tenantId
        ? structuredClone(order)
        : null;
    });
  }

  async listByTenant(tenantId: string): Promise<Order[]> {
    return this.pool.query(() =>
      [...this.orders.values()]
        .filter((order) => order.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((order) => structuredClone(order)),
    );
  }

  async save(order: Order): Promise<void> {
    await this.pool.query(() => {
      this.orders.set(order.id, structuredClone(order));
    });
  }

  /** Demo-only seeding; not part of the repository port. */
  seed(orders: readonly Order[]): void {
    for (const order of orders) {
      this.orders.set(order.id, structuredClone(order));
    }
  }

  count(): number {
    return this.orders.size;
  }
}
