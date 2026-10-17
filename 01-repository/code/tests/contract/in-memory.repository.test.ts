import { InMemoryOrderRepository } from "../../src/repositories/in-memory-order.repository";
import { orderRepositoryContract } from "../contract/order.repository.contract";

orderRepositoryContract("in-memory", async () => {
  const repo = new InMemoryOrderRepository();

  return {
    repo,
    reset: async () => repo.clear(),
  };
});
