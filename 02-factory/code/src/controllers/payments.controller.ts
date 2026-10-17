import type { RequestHandler } from "express";
import { payOrderSchema, refundOrderSchema } from "../dtos/payment.dto";
import { toOrderResponse, toPaymentResponse } from "../mappers/order.mapper";
import { asyncHandler } from "../middlewares/async-handler";
import type { PaymentService } from "../services/payment.service";

/**
 * Controllers translate HTTP <-> application calls.
 * No vendor SDKs, no persistence, no selection policy.
 */
export class PaymentsController {
  constructor(private readonly payments: PaymentService) {}

  list: RequestHandler = asyncHandler(async (_req, res) => {
    const orders = await this.payments.listOrders();
    res.json({ data: orders.map(toOrderResponse) });
  });

  getById: RequestHandler = asyncHandler(async (req, res) => {
    const order = await this.payments.getOrder(req.params.orderId);
    res.json(toOrderResponse(order));
  });

  getPayment: RequestHandler = asyncHandler(async (req, res) => {
    const payment = await this.payments.getPayment(req.params.orderId);
    res.json(toPaymentResponse(payment));
  });

  pay: RequestHandler = asyncHandler(async (req, res) => {
    const body = payOrderSchema.parse(req.body ?? {});
    const result = await this.payments.pay(req.params.orderId, body.provider);

    if (result.status === "failed") {
      res.status(402).json({
        error: "Payment failed",
        code: "payment_failed",
        ...result,
      });
      return;
    }

    res.status(202).json(result);
  });

  refund: RequestHandler = asyncHandler(async (req, res) => {
    const body = refundOrderSchema.parse(req.body ?? {});
    const result = await this.payments.refund(req.params.orderId, body.amountCents);

    res.status(202).json(result);
  });
}
