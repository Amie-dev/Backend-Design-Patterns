import { OrderService } from "./services/order.service";
import { loadConfig, type Config } from "./config/env";
import type { Order } from "./models/order.model";
import { InMemoryOrderRepository } from "./repositories/in-memory-order.repository";
import { createPrismaClient } from "./db/prisma";
import { PrismaOrderRepository } from "./repositories/prisma-order.repository";

export type Container = {
  config: Config;
  orders: OrderService;
  shutdown: () => Promise<void>;
};

function demoOrders(): Order[] {
  return [
    {
      id: "ord_demo_1",
      userId: "usr_1",
      totalCents: 1999,
      status: "pending",
      createdAt: new Date("2026-01-05T10:00:00Z"),
    },
    {
      id: "ord_demo_2",
      userId: "usr_1",
      totalCents: 4500,
      status: "paid",
      createdAt: new Date("2026-01-04T09:30:00Z"),
    },
    {
      id: "ord_demo_3",
      userId: "usr_2",
      totalCents: 899,
      status: "cancelled",
      createdAt: new Date("2026-01-03T08:15:00Z"),
    },
  ];
}

/**
 * Composition root: the only place that chooses a concrete repository.
 * Everything above this file depends on the `OrderRepository` interface.
 */
export function createContainer(config: Config = loadConfig()): Container {
  if (config.REPOSITORY === "postgres") {
    const prisma = createPrismaClient(config.DATABASE_URL);

    return {
      config,
      orders: new OrderService(new PrismaOrderRepository(prisma)),
      shutdown: () => prisma.$disconnect(),
    };
  }

  const repository = new InMemoryOrderRepository();
  if (config.SEED_DEMO) repository.seed(...demoOrders());

  return {
    config,
    orders: new OrderService(repository),
    shutdown: async () => {},
  };
}
