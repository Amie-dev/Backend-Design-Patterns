import type { Order } from "../domain/order";
import type {
  OrderRepository,
  Page,
  PageRequest,
} from "../domain/order.repository";

/**
 * In-memory adapter used by `REPOSITORY=memory`, unit tests, and the contract
 * suite. It behaves like the database adapter but needs no infrastructure.
 */
export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async findByUser(userId: string, page: PageRequest): Promise<Page<Order>> {
    const all = [...this.rows.values()]
      .filter((order) => order.userId === userId)
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      );

    const start = page.cursor
      ? Math.max(
          all.findIndex((order) => order.id === page.cursor) + 1,
          0,
        )
      : 0;
    const items = all.slice(start, start + page.limit);

    return {
      items: items.map((order) => structuredClone(order)),
      nextCursor:
        start + page.limit < all.length ? (items.at(-1)?.id ?? null) : null,
    };
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
