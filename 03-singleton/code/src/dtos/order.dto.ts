import { z } from "zod";

const orderItemSchema = z
  .object({
    sku: z.string().trim().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
    unitPriceCents: z.number().int().min(1).max(10_000_000),
  })
  .strict();

/**
 * Demo simplification: the client sends unit prices. A real checkout reads
 * prices from a catalog and accepts only SKU + quantity here.
 */
export const createOrderSchema = z
  .object({
    currency: z.enum(["USD", "INR", "EUR"]).default("USD"),
    items: z.array(orderItemSchema).min(1).max(20),
  })
  .strict();

export type CreateOrderBody = z.infer<typeof createOrderSchema>;
