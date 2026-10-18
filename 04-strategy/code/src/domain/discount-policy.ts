/**
 * A policy is *data* describing the selected rule. It carries only the
 * parameters the rule needs; it contains no behaviour.
 */
export type DiscountPolicy =
  | { readonly kind: "none" }
  | { readonly kind: "premium" }
  | { readonly kind: "student" }
  | {
      readonly kind: "festival";
      readonly fixedAmount: number;
      readonly excludedProductIds: readonly string[];
    };
