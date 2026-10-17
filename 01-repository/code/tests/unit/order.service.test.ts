import { describe, expect, it } from "vitest";
import { OrderService } from "../../src/services/order.service";
import { OrderNotFoundError, OrderStateError } from "../../src/errors/order.errors";
import { InMemoryOrderRepository } from "../../src/repositories/in-memory-order.repository";
import { anOrder } from "../builders/order.builder";

function makeService(): {
  service: OrderService;
  repo: InMemoryOrderRepository;
} {
  const repo = new InMemoryOrderRepository();
  return { service: new OrderService(repo), repo };
}

describe("OrderService", () => {
  it("creates a pending order", async () => {
    const { service } = makeService();

    const order = await service.create({ userId: "usr_1", totalCents: 2599 });

    expect(order).toMatchObject({
      userId: "usr_1",
      totalCents: 2599,
      status: "pending",
    });
    expect(order.id).toMatch(/^ord_/);
  });

  it("cancels a pending order", async () => {
    const { service, repo } = makeService();
    const order = anOrder({ status: "pending" });
    repo.seed(order);

    await service.cancel(order.id);

    expect(await repo.findById(order.id)).toMatchObject({ status: "cancelled" });
  });

  it("is idempotent when the order is already cancelled", async () => {
    const { service, repo } = makeService();
    const order = anOrder({ status: "cancelled" });
    repo.seed(order);

    await expect(service.cancel(order.id)).resolves.toBeUndefined();
    expect(await repo.findById(order.id)).toMatchObject({ status: "cancelled" });
  });

  it("refuses to cancel a paid order", async () => {
    const { service, repo } = makeService();
    const order = anOrder({ status: "paid" });
    repo.seed(order);

    await expect(service.cancel(order.id)).rejects.toBeInstanceOf(
      OrderStateError,
    );
    expect(await repo.findById(order.id)).toMatchObject({ status: "paid" });
  });

  it("throws OrderNotFoundError for an unknown order", async () => {
    const { service } = makeService();

    await expect(service.getOrder("ord_missing")).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });
});
