# Chapter 4 — Wiring, Testing, and Failure Modes

> Companion to [`../notes.md`](../notes.md) · Sections 3.5 and 5
> **Learning goals:** wire strategies from validated configuration, build a test
> matrix that catches rule regressions, state the money invariants as executable
> tests, and recognise the failure modes unique to runtime-selected behaviour.

## 4.1 Configuration decides which rules exist

A strategy is code; whether a rule is active is configuration. Keep them apart:

```ts
// config/env.ts
import { z } from "zod";
import { DISCOUNT_KEYS, type DiscountKey } from "../strategies/discount-strategy";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DISCOUNTS_ENABLED: z.string().default("premium,student"), // festival has its own rollout gate
  FESTIVAL_FIXED_AMOUNT: z.coerce.number().int().positive().default(10_000),
  FESTIVAL_EXCLUDED_IDS: z.string().default(""),
  FESTIVAL_ROLLOUT_PERCENT: z.coerce.number().int().min(0).max(100).default(100),
});

export type AppConfig = {
  readonly port: number;
  readonly enabledDiscounts: readonly DiscountKey[];
  readonly festival: {
    readonly fixedAmount: number;
    readonly excludedProductIds: readonly string[];
    readonly rolloutPercent: number;
  };
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  const enabled = parsed.DISCOUNTS_ENABLED.split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);

  const unknown = enabled.filter(
    (key) => !DISCOUNT_KEYS.includes(key as DiscountKey),
  );
  if (unknown.length > 0) {
    // Fail at boot, not on the first checkout that happens to hit the rule.
    throw new Error(`Unknown discount strategies: ${unknown.join(", ")}`);
  }

  return {
    port: parsed.PORT,
    enabledDiscounts: enabled as DiscountKey[],
    festival: {
      fixedAmount: parsed.FESTIVAL_FIXED_AMOUNT,
      excludedProductIds: parsed.FESTIVAL_EXCLUDED_IDS.split(",").filter(Boolean),
      rolloutPercent: parsed.FESTIVAL_ROLLOUT_PERCENT,
    },
  };
}
```

Rules for configuration:

- **Parse once, at boot.** No strategy, service, or controller reads
  `process.env`.
- **Reject unknown names.** A typo in `DISCOUNTS_ENABLED` must not silently
  disable a promotion.
- **Configuration is not a policy source.** It decides which rules exist; the
  customer profile and promotion table decide which one applies.
- **Never accept a strategy key from the client.** No endpoint exposes
  `?strategy=festival`.

`enabledDiscounts` is consumed once, in the composition root (4.2): a disabled
premium or student rule is wired to `NoDiscount`, so even if the policy resolver
selects it, no money is granted. The festival promotion has its own rollout gate
(4.10).

## 4.2 A composition root you can rebuild in tests

The root in chapter 3 constructs real repositories. To test the graph, accept
overrides:

```ts
// composition-root.ts
import type { Clock } from "./lib/clock";
import type { CustomerRepository } from "./ports/customer.repository";
import type { PromotionRepository } from "./ports/promotion.repository";
import { systemClock } from "./lib/clock";
import { NoDiscount } from "./strategies/no-discount.strategy";
import { PremiumDiscount } from "./strategies/premium-discount.strategy";
import { StudentDiscount } from "./strategies/student-discount.strategy";
import { DiscountStrategyRegistry } from "./services/discount-strategy.registry";
import { PricingService } from "./services/pricing.service";
import { CheckoutService } from "./services/checkout.service";
import type { AppConfig } from "./config/env";

export type ContainerOverrides = {
  customers?: CustomerRepository;
  promotions?: PromotionRepository;
  clock?: Clock;
};

export function createContainer(
  config: AppConfig,
  deps: {
    customers: CustomerRepository;
    promotions: PromotionRepository;
  },
  overrides: ContainerOverrides = {},
) {
  const none = new NoDiscount();

  const registry = new DiscountStrategyRegistry(
    config.enabledDiscounts.includes("premium")
      ? new PremiumDiscount()
      : none,
    config.enabledDiscounts.includes("student")
      ? new StudentDiscount()
      : none,
    none,
  );

  const pricing = new PricingService(
    overrides.customers ?? deps.customers,
    overrides.promotions ?? deps.promotions,
  );

  return {
    config,
    pricing,
    registry,
    checkout: new CheckoutService(
      pricing,
      registry,
      overrides.clock ?? systemClock,
    ),
  };
}
```

The production entry point passes real adapters; tests pass in-memory ports and a
fixed clock. Nothing in the graph is a module-level singleton, so every test gets
a fresh registry with no cross-test state.

## 4.3 Test matrix

| Level | What it proves | Typical count | Cost |
| --- | --- | --- | --- |
| **Strategy unit** | Each algorithm's arithmetic, boundaries, invariants | 4–8 per strategy | Milliseconds |
| **Property** | Invariants hold for a range of amounts | 1–2 per strategy | Milliseconds |
| **Registry** | Every policy kind resolves; unknown kinds fail loudly | 1 | Milliseconds |
| **Pricing service** | Precedence and eligibility against profiles/promotions | 1 table, 6–10 cases | Milliseconds |
| **Checkout service** | Orchestration: one `now`, clamped total, returned key | 2–3 | Milliseconds |
| **HTTP integration** | Validation, status codes, server-side pricing | 4–6 | Tens of milliseconds |
| **Contract** | A fake and a real adapter behave the same | optional | Seconds |

The pyramid matters: most confidence should come from strategy units and the
pricing table, not from HTTP tests. If a rule can only be tested through Express,
the boundary is in the wrong place.

## 4.4 Strategy unit tests

```ts
// tests/unit/premium-discount.strategy.test.ts
import { describe, expect, it } from "vitest";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import type { DiscountContext } from "../../src/strategies/discount-strategy";

const context = (overrides: Partial<DiscountContext> = {}): DiscountContext => ({
  amount: 10_000,
  currency: "INR",
  customerType: "premium",
  productIds: ["prod_1"],
  now: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

describe("PremiumDiscount", () => {
  const strategy = new PremiumDiscount();

  it("takes 15% of the subtotal", () => {
    expect(strategy.calculate(context())).toBe(1_500);
  });

  it("rounds half-up at the minor-unit boundary", () => {
    // 9 999 * 0.15 = 1 499.85 -> 1 500
    expect(strategy.calculate(context({ amount: 9_999 }))).toBe(1_500);
  });

  it("returns zero for an empty cart", () => {
    expect(strategy.calculate(context({ amount: 0 }))).toBe(0);
  });

  it("is deterministic for the same context", () => {
    expect(strategy.calculate(context())).toBe(strategy.calculate(context()));
  });
});
```

Table-driven tests keep the rule visible:

```ts
// tests/unit/student-discount.strategy.test.ts
import { describe, expect, it } from "vitest";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";

describe("StudentDiscount", () => {
  const strategy = new StudentDiscount();

  it.each([
    [0, 0],
    [1, 0],          // 0.1 rounds down
    [5, 1],          // 0.5 rounds up
    [10_000, 1_000],
    [12_345, 1_235], // 1 234.5 -> 1 235
  ])("amount %i -> discount %i", (amount, expected) => {
    const discount = strategy.calculate({
      amount,
      currency: "INR",
      customerType: "student",
      productIds: [],
      now: new Date("2026-01-01T00:00:00Z"),
    });

    expect(discount).toBe(expected);
  });
});
```

The festival rule needs the exclusion cases and the cap:

```ts
// tests/unit/festival-discount.strategy.test.ts
import { describe, expect, it } from "vitest";
import { FestivalDiscount } from "../../src/strategies/festival-discount.strategy";

const strategy = new FestivalDiscount(10_000, new Set(["prod_sale"]));

const context = (amount: number, productIds: string[]) => ({
  amount,
  currency: "INR" as const,
  customerType: "guest" as const,
  productIds,
  now: new Date("2026-01-01T00:00:00Z"),
});

describe("FestivalDiscount", () => {
  it("applies the fixed amount", () => {
    expect(strategy.calculate(context(50_000, ["prod_1"]))).toBe(10_000);
  });

  it("never discounts more than the cart", () => {
    expect(strategy.calculate(context(7_500, ["prod_1"]))).toBe(7_500);
  });

  it("returns zero when any product is excluded", () => {
    expect(strategy.calculate(context(50_000, ["prod_1", "prod_sale"]))).toBe(0);
  });

  it("applies when the cart is exactly the fixed amount", () => {
    expect(strategy.calculate(context(10_000, ["prod_1"]))).toBe(10_000);
  });
});
```

### The invariant test that covers every strategy

```ts
// tests/unit/discount-invariants.test.ts
import { describe, expect, it } from "vitest";
import type { DiscountStrategy } from "../../src/strategies/discount-strategy";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";
import { FestivalDiscount } from "../../src/strategies/festival-discount.strategy";
import { NoDiscount } from "../../src/strategies/no-discount.strategy";

const strategies: DiscountStrategy[] = [
  new PremiumDiscount(),
  new StudentDiscount(),
  new FestivalDiscount(10_000, new Set(["prod_sale"])),
  new NoDiscount(),
];

const cases: Array<[string, DiscountStrategy]> = strategies.map((strategy) => [
  strategy.key,
  strategy,
]);

describe("discount invariants", () => {
  it.each(cases)(
    "%s never returns a negative, fractional, or over-cart discount",
    (_key, strategy) => {
      for (let amount = 0; amount <= 200_000; amount += 137) {
        for (const productIds of [[], ["prod_1"], ["prod_sale"]]) {
          const discount = strategy.calculate({
            amount,
            currency: "INR",
            customerType: "premium",
            productIds,
            now: new Date("2026-01-01T00:00:00Z"),
          });

          expect(Number.isInteger(discount)).toBe(true);
          expect(discount).toBeGreaterThanOrEqual(0);
          expect(discount).toBeLessThanOrEqual(amount);
        }
      }
    },
  );
});
```

This one test is worth more than a dozen example-based tests: it states the
contract in executable form. If a new strategy is added, add it to the list — or
better, expose the strategies from the composition root and iterate over them.

### Registry tests

```ts
// tests/unit/discount-strategy.registry.test.ts
import { describe, expect, it } from "vitest";
import { DiscountStrategyRegistry } from "../../src/services/discount-strategy.registry";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";
import { NoDiscount } from "../../src/strategies/no-discount.strategy";
import type { DiscountPolicy } from "../../src/domain/discount-policy";

const registry = new DiscountStrategyRegistry(
  new PremiumDiscount(),
  new StudentDiscount(),
  new NoDiscount(),
);

const cases: Array<[DiscountPolicy, string]> = [
  [{ kind: "premium" }, "premium"],
  [{ kind: "student" }, "student"],
  [
    { kind: "festival", fixedAmount: 10_000, excludedProductIds: [] },
    "festival",
  ],
  [{ kind: "none" }, "none"],
];

describe("DiscountStrategyRegistry", () => {
  it.each(cases)("resolves %j to %s", (policy, expectedKey) => {
    expect(registry.resolve(policy).key).toBe(expectedKey);
  });

  it("throws for an unhandled policy kind", () => {
    expect(() =>
      registry.resolve({ kind: "vip" } as unknown as DiscountPolicy),
    ).toThrow(/No strategy registered/);
  });
});
```

## 4.5 Selection tests

Selection is where most production bugs hide, because it depends on data rather
than arithmetic. Test it as a table:

```ts
// tests/unit/pricing.service.test.ts
import { describe, expect, it } from "vitest";
import { PricingService } from "../../src/services/pricing.service";
import type { Cart } from "../../src/domain/cart";
import type { CustomerType } from "../../src/strategies/discount-strategy";
import type { FestivalPromotion } from "../../src/ports/promotion.repository";

const now = new Date("2026-02-01T10:00:00Z");

const livePromotion: FestivalPromotion = {
  id: "promo_festival_2026",
  fixedAmount: 10_000,
  excludedProductIds: ["prod_sale"],
  startsAt: new Date("2026-01-25T00:00:00Z"),
  endsAt: new Date("2026-02-10T00:00:00Z"),
};

const cart = (lines = 1): Cart => ({
  id: "cart_1",
  userId: "usr_1",
  currency: "INR",
  lines: Array.from({ length: lines }, (_, i) => ({
    productId: `prod_${i + 1}`,
    quantity: 1,
    unitAmount: 50_000,
  })),
});

function serviceFor(type: CustomerType, promotion: FestivalPromotion | null) {
  return new PricingService(
    { findById: async () => ({ id: "usr_1", type }) },
    { findActive: async () => promotion },
  );
}

const cases: Array<[string, CustomerType, FestivalPromotion | null, string]> = [
  ["premium wins over a live campaign", "premium", livePromotion, "premium"],
  ["premium with no campaign", "premium", null, "premium"],
  ["student during a campaign", "student", livePromotion, "festival"],
  ["guest during a campaign", "guest", livePromotion, "festival"],
  ["student without a campaign", "student", null, "student"],
  ["guest without a campaign", "guest", null, "none"],
];

describe("PricingService.resolvePolicy", () => {
  it.each(cases)("%s", async (_name, type, promotion, expected) => {
    const decision = await serviceFor(type, promotion).resolvePolicy(
      "usr_1",
      cart(),
      now,
    );

    expect(decision.policy.kind).toBe(expected);
    expect(decision.customerType).toBe(type);
  });

  it("treats an expired promotion as absent", async () => {
    const expired: FestivalPromotion = {
      ...livePromotion,
      endsAt: new Date("2026-01-31T00:00:00Z"),
    };

    const decision = await serviceFor("student", expired).resolvePolicy(
      "usr_1",
      cart(),
      now,
    );

    expect(decision.policy.kind).toBe("student");
  });

  it("returns none for an empty cart", async () => {
    const decision = await serviceFor("premium", livePromotion).resolvePolicy(
      "usr_1",
      cart(0),
      now,
    );

    expect(decision.policy).toEqual({ kind: "none" });
  });

  it("fails for an unknown customer", async () => {
    const service = new PricingService(
      { findById: async () => null },
      { findActive: async () => null },
    );

    await expect(
      service.resolvePolicy("usr_missing", cart(), now),
    ).rejects.toThrow(/No customer profile/);
  });
});
```

The test names describe the **policy**, not the implementation. When marketing
changes the precedence, exactly one row changes — and the diff is reviewable.

## 4.6 Checkout service tests

The service is tested with a stub registry and a fixed clock; no strategies or
database are needed:

```ts
// tests/unit/checkout.service.test.ts
import { describe, expect, it, vi } from "vitest";
import { CheckoutService } from "../../src/services/checkout.service";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import type { Cart } from "../../src/domain/cart";
import type { PricingService } from "../../src/services/pricing.service";
import type { DiscountStrategyRegistry } from "../../src/services/discount-strategy.registry";

const now = new Date("2026-02-01T10:00:00Z");
const cart: Cart = {
  id: "cart_1",
  userId: "usr_1",
  currency: "INR",
  lines: [{ productId: "prod_1", quantity: 2, unitAmount: 25_000 }],
};

function build(pricing: PricingService, registry: DiscountStrategyRegistry) {
  const clock = { now: vi.fn(() => now) };
  return {
    clock,
    service: new CheckoutService(pricing, registry, clock),
  };
}

describe("CheckoutService", () => {
  it("returns subtotal, discount, total, and the strategy key", async () => {
    const pricing = {
      resolvePolicy: async () => ({
        policy: { kind: "premium" },
        customerType: "premium",
      }),
    } as unknown as PricingService;

    const registry = {
      resolve: () => new PremiumDiscount(),
    } as unknown as DiscountStrategyRegistry;

    const { clock, service } = build(pricing, registry);
    const quote = await service.quote("usr_1", cart);

    expect(quote).toEqual({
      subtotal: 50_000,
      discount: 7_500,
      total: 42_500,
      strategy: "premium",
    });
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  it("clamps a rogue strategy so the total cannot go negative", async () => {
    const pricing = {
      resolvePolicy: async () => ({
        policy: { kind: "none" },
        customerType: "guest",
      }),
    } as unknown as PricingService;

    const rogue = {
      key: "none",
      calculate: () => 999_999,
    };
    const registry = {
      resolve: () => rogue,
    } as unknown as DiscountStrategyRegistry;

    const { service } = build(pricing, registry);
    const quote = await service.quote("usr_1", cart);

    expect(quote.discount).toBe(50_000);
    expect(quote.total).toBe(0);
  });
});
```

The second test is not paranoia. A new strategy that forgets `clampDiscount`
should not be able to produce a negative total; the service is the last line of
defence, and the invariant test in 4.4 is the first.

## 4.7 HTTP integration tests

Keep these few and focused on the transport contract: validation, status codes,
and the fact that prices are not taken from the client.

```ts
// tests/integration/checkout.api.test.ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestContainer } from "../support/test-container";

const app = createApp(createTestContainer());

describe("POST /checkout/quote", () => {
  it("quotes a premium customer using server-side prices", async () => {
    const response = await request(app)
      .post("/checkout/quote")
      .set("authorization", "Bearer test-premium")
      .send({ items: [{ productId: "prod_1", quantity: 2 }] })
      .expect(200);

    expect(response.body).toEqual({
      subtotal: 50_000,
      discount: 7_500,
      total: 42_500,
      strategy: "premium",
    });
  });

  it("rejects client-supplied prices and customer types", async () => {
    await request(app)
      .post("/checkout/quote")
      .set("authorization", "Bearer test-guest")
      .send({
        customerType: "premium",
        items: [{ productId: "prod_1", quantity: 1, unitAmount: 1 }],
      })
      .expect(400);
  });

  it("rejects an empty cart", async () => {
    await request(app)
      .post("/checkout/quote")
      .set("authorization", "Bearer test-premium")
      .send({ items: [] })
      .expect(400);
  });

  it("rejects a non-integer quantity", async () => {
    await request(app)
      .post("/checkout/quote")
      .set("authorization", "Bearer test-premium")
      .send({ items: [{ productId: "prod_1", quantity: 1.5 }] })
      .expect(400);
  });

  it("requires authentication", async () => {
    await request(app)
      .post("/checkout/quote")
      .send({ items: [{ productId: "prod_1", quantity: 1 }] })
      .expect(401);
  });
});
```

For that test to pass, the DTO must not silently accept extra fields. Make the
schema strict:

```ts
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
```

Now `customerType` and `unitAmount` produce a 400 instead of being ignored — an
even stronger guarantee, and a clearer API contract.

## 4.8 Failure modes and their guards

| Failure | What you see | Guard |
| --- | --- | --- |
| Client chooses the rule | A request field such as `customerType` or `strategy` | Policy resolved from profile/promotion; strict DTO rejects extras |
| Unknown key in configuration | A rule silently missing or crashing at request time | Validate against `DISCOUNT_KEYS` at boot |
| Discount larger than the cart | Negative total | `clampDiscount` in each strategy **and** in the service |
| Fractional or `NaN` discount | Off-by-one cents, broken JSON | `assertAmount` on inputs and outputs; integer arithmetic |
| Non-deterministic rule | Same request, different totals | Inject `now`; never call `new Date()` inside a strategy |
| Shared mutable strategy | Totals depend on request order | Stateless strategies; per-policy objects when parameterised |
| Eligibility duplicated | A rule applies in one path and not another | Eligibility only in `PricingService`; strategies do arithmetic |
| Registry missing a case | `undefined` strategy or 500 | Exhaustive switch + `assertNever`; boot-time registry check |
| Expired promotion still applied | Discount after the campaign ends | UTC date windows and boundary tests at `startsAt`/`endsAt` |
| Rounding drift across rules | Stacked discounts differ by a cent | Apply in a fixed order; round at each step; assert final invariant |
| Duplicate application | Retry charges a different total | Persist the quote and its policy; charge with an idempotency key |

The last row is not a strategy bug, but it is caused by one: a quote and a charge
that resolve the policy independently can disagree. Store the decision with the
quote (policy kind, amount, expiry) and reuse it when creating the payment
intent.

## 4.9 Observability: log the decision, not the customer

The two questions support will ask are "which rule gave this discount?" and "why
did this cart get nothing?". Answer both with structured fields:

```ts
logger.info(
  {
    event: "checkout.quoted",
    requestId,
    strategy: quote.strategy,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    currency: cart.currency,
    customerType,
  },
  "checkout quoted",
);

metrics.increment("checkout_quote_total", { strategy: quote.strategy });
metrics.observe("checkout_discount_ratio", quote.discount / Math.max(quote.subtotal, 1));
```

Rules for the signals:

- **Metrics labels stay low-cardinality.** `strategy`, `currency`, and status
  codes are fine; `userId`, cart id, and amounts are not.
- **Log the amount, not the profile.** Need the customer type to explain the
  rule? Log the type, never the name, email, or student id.
- **Sample high-volume paths.** Quote endpoints are often called on every cart
  change, not once per purchase.
- **Emit the losing candidates** when using best-of or stacked discounts;
  otherwise "why was my discount smaller?" is unanswerable.

## 4.10 A/B testing a rule without breaking checkout

A promotion rollout is a selection concern. Inject a small gate into
`PricingService` and keep the bucketing deterministic, outside the strategy:

```ts
export interface RolloutGate {
  isEnabled(userId: string, experiment: string): boolean;
}
```

```ts
// lib/rollout.ts
import { createHash } from "node:crypto";

export function isInRollout(
  userId: string,
  experiment: string,
  percent: number,
): boolean {
  if (percent <= 0) return false;
  if (percent >= 100) return true;

  const digest = createHash("sha256")
    .update(`${experiment}:${userId}`)
    .digest();

  return digest.readUInt32BE(0) % 100 < percent;
}
```

```ts
// inside PricingService, after loading the promotion
const festivalIsLive =
  promotion !== null &&
  promotion.startsAt <= now &&
  now < promotion.endsAt &&
  this.rollout.isEnabled(userId, `festival:${promotion.id}`);
```

Rules for money-related experiments:

- **Sticky by user.** A user must see the same variant from cart to charge. If the
  quote says 15% and the charge says 0%, you have a support ticket and a refund.
- **Persist the assignment.** Store the experiment key and variant with the quote
  and the order, not just in logs.
- **Have a kill switch.** Set the rollout to 0%; do not redeploy to disable it.
- **One experiment per rule.** Overlapping experiments on the same discount make
  the result uninterpretable.
- **Measure the right metric.** Conversion lift is the goal; discount cost is the
  guardrail.

```ts
logger.info(
  {
    event: "discount.experiment",
    experiment: `festival:${promotion.id}`,
    variant: "treatment",
    userId,
  },
  "discount experiment assigned",
);
```

## 4.11 Adding a rule without touching the others

The checklist that keeps the boundary honest:

- [ ] Add the key to `DISCOUNT_KEYS` (compile error until handled).
- [ ] Add a policy variant with only the data the rule needs.
- [ ] Implement one strategy class; inject its parameters, do not read env.
- [ ] Unit-test arithmetic, boundaries, exclusions, and the invariant.
- [ ] Register it in the registry; confirm `assertNever` still compiles.
- [ ] Decide eligibility and precedence in `PricingService` — not in the strategy.
- [ ] Add a config flag only if the rule must be switchable without a deploy.
- [ ] Log and meter the new key; add it to the dashboard.
- [ ] Update the rule table in the notes and the API documentation.
- [ ] Confirm `checkout.service.ts`, the controller, and the route are unchanged.

If the last item fails, the new rule leaked into the workflow. That is the signal
to move logic back behind the contract.

## Exercise

1. Write a failing test for the precedence rule you chose in chapter 3, then make
   it pass. The test should name the policy, not the class.
2. Add a strategy that returns a fractional discount on purpose. Confirm the
   invariant test fails and the service clamps the result. Then fix the strategy.
3. Replace `systemClock` with a fake clock in the checkout service test and assert
   that `resolvePolicy` and `calculate` receive the same `Date` instance.
4. Send a request with `customerType` and `unitAmount` in the body. Confirm it is
   rejected with 400 and that the error response names the offending fields.

---

**Previous:** [Chapter 3 ←](03-discount-strategies.md)
**Next:** [Chapter 5 — Production checklist, anti-patterns, and decision guide →](05-production-and-decision-guide.md)
**Index:** [Strategy notes](README.md) · **Source:** [`../notes.md`](../notes.md)
