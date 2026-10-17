import type { Order } from "../models/order.model";
import type { OrderRepository } from "./order.repository";

/**
 * In-memory adapter for the demo API, unit tests, and the HTTP test suite.
 * It behaves like a database adapter (returns copies, not shared references)
 * but needs no infrastructure.
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async list(): Promise<Order[]> {
    return [...this.rows.values()]
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((order) => structuredClone(order));
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id, structuredClone(order));
  }

  seed(...orders: Order[]): void {
    for (const order of orders) {
      this.rows.set(order.id, structuredClone(order));
    }
  }

  clear(): void {
    this.rows.clear();
  }
}
