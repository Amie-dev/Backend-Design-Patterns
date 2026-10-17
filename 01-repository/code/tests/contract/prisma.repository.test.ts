import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe } from "vitest";
import { PrismaOrderRepository } from "../../src/repositories/prisma-order.repository";
import { orderRepositoryContract } from "../contract/order.repository.contract";

const testUrl = process.env.TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;

/**
 * Optional: needs a disposable PostgreSQL database.
 *   TEST_DATABASE_URL=postgresql://demo:demo@localhost:5433/repository_demo_test \
 *     npm test
 * Run `DATABASE_URL=$TEST_DATABASE_URL npx prisma db push` once first.
 */
suite("PrismaOrderRepository (PostgreSQL)", () => {
  let prisma: PrismaClient;
  let repository: PrismaOrderRepository;

  beforeAll(() => {
    prisma = new PrismaClient({ datasourceUrl: testUrl! });
    repository = new PrismaOrderRepository(prisma);
  });

  orderRepositoryContract("postgres", async () => ({
    repo: repository,
    reset: async () => {
      await prisma.order.deleteMany();
    },
  }));

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
