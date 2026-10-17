import { z } from "zod";

/**
 * HTTP input schemas. `.strict()` rejects unknown fields so clients cannot
 * smuggle amount/currency into a request that derives both from the order.
 */
export const payOrderSchema = z
  .object({
    provider: z.string().trim().min(1).max(32).optional(),
  })
  .strict();

export const refundOrderSchema = z
  .object({
    amountCents: z.number().int().positive().max(100_000_000).optional(),
  })
  .strict();

export type PayOrderBody = z.infer<typeof payOrderSchema>;
export type RefundOrderBody = z.infer<typeof refundOrderSchema>;
