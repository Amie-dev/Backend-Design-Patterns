export type OrderStatus = "pending" | "paid" | "cancelled";

export type Order = {
  id: string;
  userId: string;
  totalCents: number;
  status: OrderStatus;
  createdAt: Date;
};
