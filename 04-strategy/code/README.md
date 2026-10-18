# Strategy Pattern — Demo API

A runnable Express + TypeScript implementation of [Pattern 4](../notes.md) and
the five [chapter notes](../notes/README.md).

The demo answers one question: **which discount applies to this cart, and who is
allowed to decide?**

```text
Client
  │  POST /checkout/quote { items: [{ productId, quantity }] }
  ▼
Router ──► authenticate ──► CheckoutController
                                  │ priceCart(userId, items)
                                  ▼
                            CatalogService ──► CatalogRepository
                                  │            (server-side prices)
                                  │ Cart
                                  ▼
                            CheckoutService ──► PricingService ──► CustomerRepository
                                  │                  │             PromotionRepository
                                  │                  └───────────► RolloutGate
                                  ▼
                       DiscountStrategyRegistry ──► Premium / Student / Festival / None
                                  │ DiscountContext
                                  ▼
                  { subtotal, discount, total, strategy }
```

The controller never chooses a rule, the strategies never read the database, and
the request never supplies a price. Those three boundaries are the whole demo.

## Quick start

Requires Node.js 20+. No database, credentials, or API keys.

```bash
cd 04-strategy/code
npm install
cp .env.example .env
npm run dev
```

The API listens on <http://localhost:3000>. If another demo from this repository
is using port 3000, start it with `PORT=3300 npm run dev`.

Production-style run:

```bash
npm run build
npm start
```

## Demo tokens

Authentication is a stand-in for a real JWT/session verifier. The token maps to a
customer profile; the profile decides the rule.

| Token | User | Default rule |
| --- | --- | --- |
| `premium-token` | `usr_premium` | 15% — beats every campaign |
| `student-token` | `usr_student` | 10% unless the festival is live |
| `guest-token` | `usr_guest` | festival when live, otherwise none |

## Try it

```bash
TOKEN=premium-token

curl -s -X POST http://localhost:3000/checkout/quote \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"items":[{"productId":"prod_1","quantity":2}]}'
```

```json
{"subtotal":50000,"discount":7500,"total":42500,"strategy":"premium"}
```

All amounts are **minor units** (paise). `prod_1` costs ₹250.00, so two units are
₹500.00 = `50000`.

| Request | Result | Why |
| --- | --- | --- |
| `guest-token` + `prod_2` × 1 | `discount: 10000`, `strategy: "festival"` | Campaign is live; ₹100 off |
| `student-token` + `prod_3` × 1 | `discount: 10000`, `strategy: "festival"` | Precedence: campaign beats student rate |
| `guest-token` + `prod_sale` × 1 | `discount: 0`, `strategy: "festival"` | The strategy returns zero for excluded products |
| body includes `customerType` or `unitAmount` | `400 invalid_request` | The strict DTO rejects pricing inputs |
| no `Authorization` header | `401 unauthorized` | The route requires an authenticated user |
| `prod_missing` | `404 product_not_found` | The catalog is the only price source |
| `prod_unavailable` | `422 invalid_cart` | Unavailable products never reach pricing |

Inspect the active rules without a checkout:

```bash
curl -s http://localhost:3000/pricing/rules | jq
```

## Folder structure

```text
04-strategy/code/
├── .env.example                 # every knob, with safe defaults
├── package.json
├── tsconfig.json                # strict; includes src + tests
├── tsconfig.build.json          # emit to dist/
├── vitest.config.ts
├── README.md
├── src/
│   ├── server.ts                # listen + graceful shutdown
│   ├── app.ts                   # express app; routes, health, 404, error handler
│   ├── composition-root.ts      # the ONLY place that constructs the graph
│   ├── config/
│   │   └── env.ts               # zod-validated AppConfig; fails at boot
│   ├── routes/
│   │   └── checkout.routes.ts   # URL + middleware -> controller
│   ├── controllers/
│   │   └── checkout.controller.ts  # validate body, call one service method
│   ├── services/
│   │   ├── checkout.service.ts     # orchestration + final invariant
│   │   ├── pricing.service.ts      # policy selection (the only selector)
│   │   ├── catalog.service.ts      # product refs -> cart with real prices
│   │   └── discount-strategy.registry.ts  # policy -> strategy instance
│   ├── strategies/
│   │   ├── discount-strategy.ts    # contract + DiscountContext + keys
│   │   ├── premium-discount.strategy.ts
│   │   ├── student-discount.strategy.ts
│   │   ├── festival-discount.strategy.ts
│   │   └── no-discount.strategy.ts
│   ├── domain/
│   │   ├── cart.ts                 # Cart, CartLine, subtotal()
│   │   ├── customer.ts             # CustomerType, CustomerProfile
│   │   ├── discount-policy.ts      # discriminated union (data)
│   │   └── money.ts                # minor units, rounding, clamping
│   ├── ports/                      # interfaces the inside owns
│   │   ├── catalog.repository.ts
│   │   ├── customer.repository.ts
│   │   └── promotion.repository.ts
│   ├── repositories/               # in-memory adapters behind the ports
│   │   ├── in-memory-catalog.repository.ts
│   │   ├── in-memory-customer.repository.ts
│   │   └── in-memory-promotion.repository.ts
│   ├── dtos/
│   │   └── checkout.dto.ts         # strict zod schema
│   ├── errors/
│   │   └── discount.errors.ts      # code + status, mapped once
│   ├── middlewares/
│   │   ├── authenticate.ts
│   │   ├── async-handler.ts
│   │   ├── request-id.ts
│   │   ├── request-logger.ts
│   │   └── error-handler.ts
│   ├── lib/
│   │   ├── clock.ts                # Clock port; fixed clock for tests
│   │   ├── logger.ts               # JSON lines; no-op logger for tests
│   │   └── rollout.ts              # deterministic per-user bucketing
│   └── types/
│       └── express.d.ts            # req.id and req.user
└── tests/
    ├── builders/                   # cart + context builders
    ├── support/                    # test config, createTestContainer
    ├── unit/                       # strategies, registry, pricing, config
    └── integration/                # HTTP contract with supertest
```

The layout is layer-first on purpose: it makes the dependency direction visible.
A feature-first version moves the checkout files into `modules/checkout/` and
keeps shared rules in `discounts/`; the rules do not change
([chapter notes, folder structure](../notes/README.md#folder-structure)).

## Who may import whom

| Layer | May import | Must not import |
| --- | --- | --- |
| `routes/` | controllers, middleware | services, domain, ports |
| `controllers/` | DTOs, services, errors | repositories, strategies |
| `services/` | ports, domain, strategies, lib | Express, concrete repositories |
| `strategies/` | domain types, money, errors | services, ports, repositories, config, HTTP |
| `domain/` | other domain types only | everything else |
| `ports/` | domain types | implementations, framework code |
| `repositories/` | ports, domain | services, controllers, HTTP |
| `composition-root.ts` | everything | — |

If a rule needs new data, it arrives in `DiscountContext` or in its constructor.
If a strategy imports Prisma, Express, or `process.env`, the boundary has leaked.

## Request lifecycle

1. `routes/checkout.routes.ts` attaches `authenticate` and the async wrapper.
2. `middlewares/authenticate.ts` turns a bearer token into `req.user`.
3. `controllers/checkout.controller.ts` parses the strict DTO and calls
   `catalog.priceCart` exactly once.
4. `services/catalog.service.ts` loads products by id and builds the cart from
   **catalog prices**, rejecting missing, unavailable, or mixed-currency items.
5. `services/checkout.service.ts` captures one `now`, asks
   `pricing.resolvePolicy`, and resolves the strategy.
6. `services/pricing.service.ts` loads the profile and the live promotion,
   applies the rollout gate, and returns a `DiscountPolicy`.
7. `services/discount-strategy.registry.ts` maps that policy to one strategy;
   the strategy computes; the service clamps and returns the quote.
8. `middlewares/error-handler.ts` maps domain errors (404/422) and validation
   errors (400) once; unexpected errors become 500 plus a log line.

## Where each chapter lives in the code

| Chapter | Files to read first |
| --- | --- |
| [1 — Why a boundary](../notes/01-why-strategy.md) | Compare `services/pricing.service.ts` with `strategies/premium-discount.strategy.ts`: selection and arithmetic are separate |
| [2 — Concept and boundaries](../notes/02-concept-and-boundaries.md) | `strategies/discount-strategy.ts`, `domain/discount-policy.ts`, `services/discount-strategy.registry.ts` |
| [3 — End to end](../notes/03-discount-strategies.md) | `domain/*`, `strategies/*`, `services/*`, `controllers/`, `routes/`, `composition-root.ts` |
| [4 — Wiring and testing](../notes/04-wiring-and-testing.md) | `config/env.ts`, `tests/**`, `lib/clock.ts`, `lib/rollout.ts`, `middlewares/*` |
| [5 — Production and decisions](../notes/05-production-and-decision-guide.md) | `domain/money.ts`, `errors/discount.errors.ts`, `dtos/checkout.dto.ts`, this README |

## Tests

```bash
npm test
```

```text
Test Files  10 passed (10)
Tests       61 passed (61)
```

| File | Proves |
| --- | --- |
| `tests/unit/premium-discount.strategy.test.ts` | 15%, half-up rounding, determinism |
| `tests/unit/student-discount.strategy.test.ts` | 10%, rounding table |
| `tests/unit/festival-discount.strategy.test.ts` | Fixed amount, cap, exclusions |
| `tests/unit/discount-invariants.test.ts` | Every strategy: integer, `>= 0`, `<= amount` |
| `tests/unit/discount-strategy.registry.test.ts` | Every policy resolves; unknown kinds throw |
| `tests/unit/pricing.service.test.ts` | Precedence, rollout fallback, empty cart, unknown customer |
| `tests/unit/checkout.service.test.ts` | One clock read, total arithmetic, rogue-strategy clamp |
| `tests/unit/config.test.ts` | Defaults, unknown names, bad percentages, inverted windows |
| `tests/unit/rollout.test.ts` | 0/100 boundaries, per-user stability, population split |
| `tests/integration/checkout.api.test.ts` | Auth, validation, server-side pricing, 404/422, headers |

The integration suite proves the security property that matters: sending
`customerType` or `unitAmount` produces a 400, and the catalog price wins.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `DISCOUNTS_ENABLED` | `premium,student` | Non-campaign rules wired into the registry; unknown names fail at boot |
| `FESTIVAL_ENABLED` | `true` | Whether the promotion repository returns a live campaign |
| `FESTIVAL_FIXED_AMOUNT` | `10000` | ₹100 in paise |
| `FESTIVAL_EXCLUDED_IDS` | `prod_sale` | Cart containing any of these gets zero |
| `FESTIVAL_ROLLOUT_PERCENT` | `100` | Deterministic per-user bucket |
| `FESTIVAL_STARTS_AT` / `FESTIVAL_ENDS_AT` | now − 1 day / now + 30 days | ISO-8601 window |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown budget |

`DISCOUNTS_ENABLED` gates premium and student; the festival has its own enable
flag and rollout gate.

## Add a new rule (the whole point)

Suppose marketing wants **20% off a customer's first order**. In this codebase
that is five small edits and one new file:

```ts
// 1. domain/discount-policy.ts — add the data variant
| { readonly kind: "first_order" }

// 2. strategies/discount-strategy.ts — add the key
export const DISCOUNT_KEYS = [
  "none", "premium", "student", "festival", "first_order",
] as const;

// 3. strategies/first-order-discount.strategy.ts — one pure class
export class FirstOrderDiscount implements DiscountStrategy {
  readonly key = "first_order" as const;
  calculate({ amount }: DiscountContext): number {
    return clampDiscount(percentage(amount, 0.2), amount);
  }
}

// 4. services/discount-strategy.registry.ts — one constructor arg + one case
case "first_order":
  return this.firstOrder;

// 5. services/pricing.service.ts — the precedence decision
if (profile.firstOrder) {
  return { policy: { kind: "first_order" }, customerType: profile.type };
}
```

Then add `tests/unit/first-order-discount.strategy.test.ts`, a row to the pricing
table, and `new FirstOrderDiscount()` in `composition-root.ts`.

**Untouched:** `checkout.service.ts`, `checkout.controller.ts`,
`checkout.routes.ts`, the DTO, and the error handler. If you had to change any of
them, the rule leaked out of the strategy boundary — the exercise in
[chapter 5](../notes/05-production-and-decision-guide.md) is to move it back.

## Design decisions worth copying

| Decision | Where | Why |
| --- | --- | --- |
| Integer minor units, half-up rounding | `domain/money.ts` | Floats drift; the rounding rule is a product decision and is tested |
| Policy is data, strategy is behaviour | `domain/discount-policy.ts` | A new campaign changes data, not code paths |
| Selection has one home | `services/pricing.service.ts` | Prevents the controller/registry/service from disagreeing |
| Strategies are stateless and pure | `strategies/*` | Safe to share, trivial to test, cache, and compare |
| Parameterised rules are built per policy | `festival-discount.strategy.ts` | Campaign parameters live with the campaign, not the singleton |
| `now` is injected once | `checkout.service.ts`, `lib/clock.ts` | Quote and policy see the same instant |
| The discount is clamped twice | strategies and `checkout.service.ts` | A buggy rule still cannot produce a negative total |
| Unknown policy throws | `discount-strategy.registry.ts` | `assertNever` turns a forgotten case into a 500 and an alert |
| Prices come from the catalog | `catalog.service.ts` | The request can only name products and quantities |
| Strict DTO | `dtos/checkout.dto.ts` | `customerType` / `unitAmount` are rejected, not ignored |
| Deterministic rollout | `lib/rollout.ts` | The same user gets the same variant from quote to charge |
| Ports for profile, promotion, catalog | `ports/*` | Tests run with fakes; adapters can become SQL/HTTP without touching rules |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | `tsx watch` on `src/server.ts` |
| `npm test` | Vitest: 10 files, 61 tests |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | `tsc --noEmit` (strict, includes tests) |
| `npm run build` | Emit `dist/` from `src/` |
| `npm start` | Run the compiled server |

## Related reading

- [Chapter 1 — Why a growing conditional needs a boundary](../notes/01-why-strategy.md)
- [Chapter 2 — The strategy concept and its boundaries](../notes/02-concept-and-boundaries.md)
- [Chapter 3 — Discount strategies, end to end](../notes/03-discount-strategies.md)
- [Chapter 4 — Wiring, testing, and failure modes](../notes/04-wiring-and-testing.md)
- [Chapter 5 — Production checklist, anti-patterns, and decision guide](../notes/05-production-and-decision-guide.md)
- [Factory pattern](../../02-factory/notes.md) — creation vs behaviour
- [Decorator pattern](../../08-decorator/notes.md) — wrap a strategy with caching or metrics
- [AI-ready blueprint](../../11-ai-ready-blueprint/notes.md) — the same strategy shape for model routing



