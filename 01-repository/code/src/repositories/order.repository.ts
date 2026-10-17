import type { Order } from "../models/order.model";

export type PageRequest = {
  limit: number;
  cursor?: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

/**
 * Persistence contract expressed in domain language.
 * No Prisma, SQL, or Express types are allowed in this file.
 */
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUser(userId: string, page: PageRequest): Promise<Page<Order>>;
  save(order: Order): Promise<void>;
}
