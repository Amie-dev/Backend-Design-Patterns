import type { RequestHandler } from "express";
import { createOrderSchema } from "../dtos/order.dto";
import { currentRequestContext } from "../lib/request-context";
import { toOrderListResponse, toOrderResponse } from "../mappers/order.mapper";
import { asyncHandler } from "../middlewares/async-handler";
import type { OrderService } from "../services/order.service";

/**
 * Controllers translate HTTP <-> application calls. They read identity from
 * the request context and pass it explicitly to the service.
 */
export class OrdersController {
  constructor(private readonly orders: OrderService) {}

  list: RequestHandler = asyncHandler(async (_req, res) => {
    const { tenantId } = currentRequestContext();
    const orders = await this.orders.list(tenantId);

    res.json(toOrderListResponse(orders));
  });

  getById: RequestHandler = asyncHandler(async (req, res) => {
    const { tenantId } = currentRequestContext();
    const order = await this.orders.getById(req.params.orderId, tenantId);

    res.json(toOrderResponse(order));
  });

  create: RequestHandler = asyncHandler(async (req, res) => {
    const body = createOrderSchema.parse(req.body ?? {});
    const { tenantId, userId } = currentRequestContext();
    const order = await this.orders.create(body, { tenantId, userId });

    res.status(201).json(toOrderResponse(order));
  });

  cancel: RequestHandler = asyncHandler(async (req, res) => {
    const { tenantId } = currentRequestContext();
    const order = await this.orders.cancel(req.params.orderId, tenantId);

    res.json(toOrderResponse(order));
  });
}
