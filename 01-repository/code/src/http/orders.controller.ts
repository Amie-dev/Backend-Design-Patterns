import type { RequestHandler } from "express";
import type { OrderService } from "../application/order.service";
import { asyncHandler } from "./async-handler";
import {
  createOrderSchema,
  listOrdersQuerySchema,
  toOrderResponse,
} from "./order.dto";

/**
 * Controllers translate HTTP <-> application calls. No persistence knowledge.
 */
export class OrdersController {
  constructor(private readonly orders: OrderService) {}

  create: RequestHandler = asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    const order = await this.orders.create(input);

    res.status(201).json(toOrderResponse(order));
  });

  list: RequestHandler = asyncHandler(async (req, res) => {
    const query = listOrdersQuerySchema.parse(req.query);
    const { userId, ...page } = query;
    const result = await this.orders.listOrders(userId, page);

    res.json({
      data: result.items.map(toOrderResponse),
      nextCursor: result.nextCursor,
    });
  });

  getById: RequestHandler = asyncHandler(async (req, res) => {
    const order = await this.orders.getOrder(req.params.id);
    res.json(toOrderResponse(order));
  });

  cancel: RequestHandler = asyncHandler(async (req, res) => {
    await this.orders.cancel(req.params.id);
    res.status(204).end();
  });
}
