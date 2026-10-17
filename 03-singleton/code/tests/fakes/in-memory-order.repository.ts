import type { Order } from "../../src/models/order.model";
import type { OrderRepository } from "../../src/repositories/order.repository";

/** Test double for the persistence port. It records call counts so cache tests
 * can prove a second read never reaches the repository. */
export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  findByIdCalls = 0;
  listByTenantCalls = 0;
  saveCalls = 0;

  async findById(id: string, tenantId: string): Promise<Order | null> {
    this.findByIdCalls += 1;
    const order = this.orders.get(id);

    return order && order.tenantId === tenantId
      ? structuredClone(order)
      : null;
  }

  async listByTenant(tenantId: string): Promise<Order[]> {
    this.listByTenantCalls += 1;

    return [...this.orders.values()]
      .filter((order) => order.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => structuredClone(order));
  }

  async save(order: Order): Promise<void> {
    this.saveCalls += 1;
    this.orders.set(order.id, structuredClone(order));
  }

  seed(...orders: Order[]): void {
    for (const order of orders) {
      this.orders.set(order.id, structuredClone(order));
    }
  }
}
