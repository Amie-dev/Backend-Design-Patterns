import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const orders = [
  {
    id: "ord_demo_1",
    userId: "usr_1",
    totalCents: 1999,
    status: "pending" as const,
    createdAt: new Date("2026-01-05T10:00:00Z"),
  },
  {
    id: "ord_demo_2",
    userId: "usr_1",
    totalCents: 4500,
    status: "paid" as const,
    createdAt: new Date("2026-01-04T09:30:00Z"),
  },
  {
    id: "ord_demo_3",
    userId: "usr_2",
    totalCents: 899,
    status: "cancelled" as const,
    createdAt: new Date("2026-01-03T08:15:00Z"),
  },
];

async function main(): Promise<void> {
  for (const order of orders) {
    await prisma.order.upsert({
      where: { id: order.id },
      create: order,
      update: {
        totalCents: order.totalCents,
        status: order.status,
      },
    });
  }

  console.log(`Seeded ${orders.length} orders.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
