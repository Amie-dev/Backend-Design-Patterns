import { Prisma } from "@prisma/client";
import type { Order } from "../domain/order";

export const orderSelect = {
  id: true,
  userId: true,
  totalCents: true,
  status: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export function toDomain(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.userId,
    totalCents: row.totalCents,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toPersistence(order: Order): Prisma.OrderCreateInput {
  return {
    id: order.id,
    userId: order.userId,
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt,
  };
}
