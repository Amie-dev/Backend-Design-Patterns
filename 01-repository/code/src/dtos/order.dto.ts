import { z } from "zod";
import type { Order } from "../models/order.model";

export const createOrderSchema = z.object({
  userId: z.string().min(1),
  totalCents: z.number().int().positive(),
});

export const listOrdersQuerySchema = z.object({
  userId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export function toOrderResponse(order: Order) {
  return {
    id: order.id,
    userId: order.userId,
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}
