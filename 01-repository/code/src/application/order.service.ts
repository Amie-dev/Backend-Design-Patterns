import { randomUUID } from "node:crypto";
import { OrderNotFoundError, OrderStateError } from "../domain/errors";
import type { Order } from "../domain/order";
import type { OrderRepository, Page, PageRequest } from "../domain/order.repository";

export type CreateOrderInput = {
  userId: string;
  totalCents: number;
};

export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  async create(input: CreateOrderInput): Promise<Order> {
    const order: Order = {
      id: `ord_${randomUUID()}`,
      userId: input.userId,
      totalCents: input.totalCents,
      status: "pending",
      createdAt: new Date(),
    };

    await this.orders.save(order);
    return order;
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.orders.findById(id);
    if (!order) throw new OrderNotFoundError(id);
    return order;
  }

  async listOrders(userId: string, page: PageRequest): Promise<Page<Order>> {
    const limit = Math.min(Math.max(page.limit, 1), 100);
    return this.orders.findByUser(userId, { ...page, limit });
  }

  async cancel(id: string): Promise<void> {
    const order = await this.getOrder(id);

    if (order.status === "paid") {
      throw new OrderStateError("Paid orders must be refunded, not cancelled");
    }
    if (order.status === "cancelled") return; // idempotent

    await this.orders.save({ ...order, status: "cancelled" });
  }
}
