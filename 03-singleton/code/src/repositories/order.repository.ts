import type { Order } from "../models/order.model";

/**
 * Persistence port. The service depends on this shape, never on the pool,
 * Prisma, or SQL. Tenant id is part of every read so isolation is enforced
 * at the repository boundary as well as in the service.
 */
export type OrderRepository = {
  findById(id: string, tenantId: string): Promise<Order | null>;
  listByTenant(tenantId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
};
