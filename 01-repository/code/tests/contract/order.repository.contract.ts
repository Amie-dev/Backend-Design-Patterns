import { beforeEach, describe, expect, it } from "vitest";
import type { OrderRepository } from "../../src/domain/order.repository";
import { anOrder } from "../builders/order.builder";

type Harness = {
  repo: OrderRepository;
  reset: () => Promise<void>;
};

/**
 * One suite, run against every adapter. If the fake and Prisma disagree,
 * this test fails before the difference reaches production.
 */
export function orderRepositoryContract(
  name: string,
  setup: () => Promise<Harness>,
): void {
  describe(`OrderRepository contract: ${name}`, () => {
    let harness: Harness;

    beforeEach(async () => {
      harness = await setup();
      await harness.reset();
    });

    it("returns null for an unknown id", async () => {
      expect(await harness.repo.findById("missing")).toBeNull();
    });

    it("round-trips an order", async () => {
      const order = anOrder();
      await harness.repo.save(order);

      expect(await harness.repo.findById(order.id)).toEqual(order);
    });

    it("updates an existing order", async () => {
      const order = anOrder({ status: "pending" });
      await harness.repo.save(order);
      await harness.repo.save({ ...order, status: "cancelled" });

      expect(await harness.repo.findById(order.id)).toMatchObject({
        status: "cancelled",
      });
    });

    it("returns only the requested user's orders", async () => {
      await harness.repo.save(anOrder({ userId: "usr_a" }));
      await harness.repo.save(anOrder({ userId: "usr_b" }));

      const page = await harness.repo.findByUser("usr_a", { limit: 20 });

      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.userId).toBe("usr_a");
    });

    it("paginates without duplicates or gaps", async () => {
      const orders = [anOrder(), anOrder(), anOrder()];
      for (const order of orders) await harness.repo.save(order);

      const first = await harness.repo.findByUser("usr_test", { limit: 2 });
      const second = await harness.repo.findByUser("usr_test", {
        limit: 2,
        cursor: first.nextCursor ?? undefined,
      });

      const ids = [...first.items, ...second.items].map((order) => order.id);

      expect(first.items).toHaveLength(2);
      expect(new Set(ids).size).toBe(3);
      expect(second.nextCursor).toBeNull();
    });
  });
}
