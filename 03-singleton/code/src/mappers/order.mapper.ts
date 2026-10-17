import type { Order, OrderItem } from "../models/order.model";

export type OrderResponse = Order & { items: OrderItem[] };

/** Copy the entity so HTTP callers cannot mutate a cached instance. */
export function toOrderResponse(order: Order): OrderResponse {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
  };
}

export function toOrderListResponse(orders: readonly Order[]) {
  return {
    data: orders.map(toOrderResponse),
    meta: { count: orders.length },
  };
}
