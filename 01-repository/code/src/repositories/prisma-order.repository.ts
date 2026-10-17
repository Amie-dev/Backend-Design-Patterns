import { Prisma, PrismaClient } from "@prisma/client";
import { OrderNotFoundError, RepositoryError } from "../errors/order.errors";
import type { Order } from "../models/order.model";
import type {
  OrderRepository,
  Page,
  PageRequest,
} from "./order.repository";
import { orderSelect, toDomain, toPersistence } from "../mappers/order.mapper";

type OrderDb = PrismaClient | Prisma.TransactionClient;

/**
 * Adapter: the only layer that knows Prisma, SQL, table and column names.
 */
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: OrderDb) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });

    return row ? toDomain(row) : null;
  }

  async findByUser(userId: string, page: PageRequest): Promise<Page<Order>> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      select: orderSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > page.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map(toDomain);

    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async save(order: Order): Promise<void> {
    try {
      await this.prisma.order.upsert({
        where: { id: order.id },
        create: toPersistence(order),
        update: {
          totalCents: order.totalCents,
          status: order.status,
        },
      });
    } catch (error) {
      this.translate(error, order.id);
    }
  }

  /** Driver errors never leave this adapter. */
  private translate(error: unknown, orderId: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new RepositoryError("Order already exists", { cause: error });
      }
      if (error.code === "P2025") {
        throw new OrderNotFoundError(orderId);
      }
    }

    throw new RepositoryError("Order persistence failed", { cause: error });
  }
}
