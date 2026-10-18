import type { Request, Response } from "express";
import { quoteRequestSchema } from "../dtos/checkout.dto";
import type { CatalogService } from "../services/catalog.service";
import type { CheckoutService } from "../services/checkout.service";

/**
 * Translates HTTP into one use case. No pricing decision is made here:
 * `customerType`, the strategy key, and prices all come from trusted sources.
 */
export class CheckoutController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly checkout: CheckoutService,
  ) {}

  quote = async (req: Request, res: Response): Promise<void> => {
    const { items } = quoteRequestSchema.parse(req.body);

    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const cart = await this.catalog.priceCart(req.user.id, items);
    const quote = await this.checkout.quote(req.user.id, cart);

    res.status(200).json(quote);
  };
}
