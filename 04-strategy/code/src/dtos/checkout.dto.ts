import { z } from "zod";

/**
 * The client sends product references and quantities only.
 * `.strict()` rejects `unitAmount` or `customerType` instead of silently
 * ignoring attempts to influence pricing.
 */
export const quoteRequestSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1).max(64),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
