import type { Order } from "../models/order.model";

/**
 * Persistence port expressed in domain language. The payment service never
 * knows whether orders live in memory or in PostgreSQL.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  list(): Promise<Order[]>;
  save(order: Order): Promise<void>;
}
