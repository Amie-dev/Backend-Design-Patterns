# Strategy Pattern — Chapter Notes

Companion deep-dive to [`../notes.md`](../notes.md). The main notes are the
one-page reference; these chapters expand every section with reasoning,
copy-ready TypeScript/Express code, tests, and production guidance.

**Pattern 4 of 10** · TypeScript · Node.js · Express · Vitest

## Chapters

| # | Chapter | Focus | Source |
| --- | --- | --- | --- |
| 1 | [Why a growing conditional needs a boundary](01-why-strategy.md) | The discount function, four hidden costs, why inheritance fails, when an `if` is correct | §1 |
| 2 | [The strategy concept and its boundaries](02-concept-and-boundaries.md) | Context / strategy / selector, contract design, strategy vs factory vs state vs policy | §2, §4 |
| 3 | [Discount strategies, end to end](03-discount-strategies.md) | Domain types, implementations, policy data, registry, checkout service, HTTP, composition root | §3 |
| 4 | [Wiring, testing, and failure modes](04-wiring-and-testing.md) | Config-driven enablement, unit/property/HTTP tests, money invariants, observability, A/B rollout | §3.5, §5 |
| 5 | [Production checklist, anti-patterns, and decision guide](05-production-and-decision-guide.md) | Ship checklist, ten anti-patterns, refactor recipe, decision flow, AI routing example | §5–10 |

## Suggested reading paths

- **New to the pattern:** 1 → 2 → 3. Stop after the sequence diagram and build
  the discount example yourself.
- **Refactoring an existing service:** 1 → 3 → 4. Write characterization tests
  before extracting the first strategy.
- **Reviewing a design:** 2 → 5. Use the three-role table and the anti-pattern
  list as the review checklist.
- **Interview preparation:** 2 → 5, then explain from memory why a strategy is
  not a factory and why a policy is not a strategy.

## Prerequisites

- Node.js 20+ and TypeScript 5+
- Express 4.19+ (Express 5 forwards rejected promises natively)
- `zod` for boundary validation, `vitest` + `supertest` for tests
- Money handled as an integer in the smallest currency unit (cents/paise)
- Familiarity with constructor injection and the repository pattern
  ([`../../01-repository/notes`](../../01-repository/notes/README.md))
- Helpful but not required: factory
  ([`../../02-factory/notes`](../../02-factory/notes/README.md)) and singleton
  ([`../../03-singleton/notes`](../../03-singleton/notes/README.md)) chapters

## Folder structure

Strategy is **behaviour that varies**, not a feature and not a layer of its own.
The layout therefore has two rules:

1. **Strategies live next to the data they operate on** — a pricing rule belongs
   to pricing, an auth rule to auth.
2. **Selection lives in a service or registry, never in a controller.** The
   controller may translate HTTP; it may not decide which rule applies.

The [`../code`](../code/README.md) folder contains a runnable demo implementing
these chapters: an Express API with a strict quote DTO, a catalog and promotion
port, four strategies, an exhaustive registry, deterministic rollout, and 61
tests that need no database or credentials.

The chapters use the layer-first layout below. A feature-first variant is shown
after it; both keep the same dependency direction.

### Layer-first (used in the chapter snippets)

```text
src/
├── routes/
│   └── checkout.routes.ts              # URL + method -> controller
├── controllers/
│   └── checkout.controller.ts          # parse input, call one service, map result
├── services/
│   ├── checkout.service.ts             # orchestrates policy -> strategy -> total
│   ├── pricing.service.ts              # loads the authoritative policy (trusted source)
│   └── discount-strategy.registry.ts   # selection only; no rule logic
├── strategies/
│   ├── discount-strategy.ts            # contract + DiscountContext
│   ├── premium-discount.strategy.ts    # 15%
│   ├── student-discount.strategy.ts    # 10%
│   ├── festival-discount.strategy.ts   # fixed amount, exclusions
│   └── no-discount.strategy.ts         # explicit null object
├── domain/
│   ├── cart.ts                         # Cart, CartLine
│   ├── customer.ts                     # CustomerType
│   ├── discount-policy.ts              # discriminated union (data, not behaviour)
│   └── money.ts                        # minor units, rounding, clamping
├── dtos/
│   └── checkout.dto.ts                 # zod schemas, request/response shapes
├── errors/
│   └── discount.errors.ts              # UnknownStrategyError, InvalidDiscountError
├── middlewares/
│   ├── async-handler.ts
│   └── error-handler.ts
├── config/
│   └── env.ts                          # which rules are enabled, rollout percentages
├── composition-root.ts                 # constructs strategies once, builds the registry
├── app.ts                              # express app, no listening
└── server.ts                           # listen + shutdown
```

### Feature-first (recommended once there are several domains)

```text
src/
├── modules/
│   ├── checkout/
│   │   ├── checkout.routes.ts
│   │   ├── checkout.controller.ts
│   │   ├── checkout.service.ts
│   │   ├── pricing.service.ts
│   │   ├── discount-strategy.registry.ts
│   │   ├── checkout.dto.ts
│   │   └── discount.errors.ts
│   └── orders/
│       ├── order.routes.ts
│       ├── order.controller.ts
│       └── order.service.ts
├── discounts/                          # shared rule vocabulary, imported by modules
│   ├── discount-strategy.ts
│   ├── discount-policy.ts
│   ├── premium-discount.strategy.ts
│   ├── student-discount.strategy.ts
│   ├── festival-discount.strategy.ts
│   └── no-discount.strategy.ts
├── shared/
│   ├── money.ts
│   └── async-handler.ts
└── composition-root.ts
```

Keep the strategies in a top-level `discounts/` folder only while more than one
module uses them. Once checkout is the sole consumer, move them into
`modules/checkout/`.

### What lives where

| Path | Responsibility | May import |
| --- | --- | --- |
| `*.routes.ts` | URL + method → controller; attach middleware | controller, middleware |
| `*.controller.ts` | Validate HTTP input, call **one** service method, shape the response | service, DTO, errors |
| `checkout.service.ts` | Orchestrate: get policy → resolve strategy → calculate → total | registry, pricing service, domain |
| `pricing.service.ts` | Load the customer profile and promotion config; return the authoritative policy | repositories/ports, domain |
| `discount-strategy.registry.ts` | Map a `DiscountPolicy` to a `DiscountStrategy` | strategies, domain |
| `*-discount.strategy.ts` | One pure algorithm; no I/O, no config reads | domain types, errors |
| `discount-strategy.ts` | The contract and its `DiscountContext` | domain types |
| `discount-policy.ts` | Data describing the selected rule | domain types only |
| `money.ts` | Arithmetic, rounding, clamping, currency checks | nothing |
| `composition-root.ts` | Construct stateless strategies once; build the registry and services | everything |
| `config/env.ts` | Enabled strategies, rollout flags, defaults | zod, domain constants |

The dependency direction is one-way:

```text
routes -> controllers -> services -> strategies
                          |  |
                          |  +-> domain (policy, money, cart)
                          +----> ports (customer profile, promotions)
```

Strategies never import Express, Prisma, or `process.env`. If a strategy needs
data, it arrives in `DiscountContext` or in its constructor.

### Naming rules

| File | Convention | Example |
| --- | --- | --- |
| Contract | `<concept>-strategy.ts` | `discount-strategy.ts` |
| Implementation | `<variant>-<concept>.strategy.ts` | `premium-discount.strategy.ts` |
| Policy data | `<concept>-policy.ts` | `discount-policy.ts` |
| Selector | `<concept>-strategy.registry.ts` | `discount-strategy.registry.ts` |
| Service | `<concept>.service.ts` | `checkout.service.ts` |
| Router | `<resource>.routes.ts` | `checkout.routes.ts` |
| Controller | `<resource>.controller.ts` | `checkout.controller.ts` |
| DTO | `<concept>.dto.ts` | `checkout.dto.ts` |
| Errors | `<concept>.errors.ts` | `discount.errors.ts` |
| Test | `<subject>.test.ts` | `premium-discount.strategy.test.ts` |

One exported class per file, named exports only. The contract is an `interface`,
implementations are `class … implements DiscountStrategy`, and the registry is the
only module that knows every implementation.

### How the chapter snippets map

The chapters use the layer-first paths. The same files in a feature-first app:

| Chapter snippet | Feature-first | Layer-first |
| --- | --- | --- |
| `strategies/discount-strategy.ts` | `discounts/discount-strategy.ts` | `strategies/discount-strategy.ts` |
| `strategies/premium-discount.strategy.ts` | `discounts/premium-discount.strategy.ts` | `strategies/premium-discount.strategy.ts` |
| `strategies/festival-discount.strategy.ts` | `discounts/festival-discount.strategy.ts` | `strategies/festival-discount.strategy.ts` |
| `domain/discount-policy.ts` | `discounts/discount-policy.ts` | `domain/discount-policy.ts` |
| `services/discount-strategy.registry.ts` | `modules/checkout/discount-strategy.registry.ts` | `services/discount-strategy.registry.ts` |
| `services/checkout.service.ts` | `modules/checkout/checkout.service.ts` | `services/checkout.service.ts` |
| `services/pricing.service.ts` | `modules/checkout/pricing.service.ts` | `services/pricing.service.ts` |
| `controllers/checkout.controller.ts` | `modules/checkout/checkout.controller.ts` | `controllers/checkout.controller.ts` |
| `routes/checkout.routes.ts` | `modules/checkout/checkout.routes.ts` | `routes/checkout.routes.ts` |
| `dtos/checkout.dto.ts` | `modules/checkout/checkout.dto.ts` | `dtos/checkout.dto.ts` |
| `errors/discount.errors.ts` | `modules/checkout/discount.errors.ts` | `errors/discount.errors.ts` |
| `composition-root.ts` | `src/composition-root.ts` | `src/composition-root.ts` |

### Conventions in these chapters

- Money is an integer in the **smallest currency unit** (cents/paise). No floats,
  no `parseFloat` on a monetary value.
- `amount`, `discount`, and `total` are all in minor units and share one currency.
- The **policy** comes from the customer profile and promotion configuration —
  never from a request field such as `customerType`.
- Strategies are pure: same context in, same discount out. Time is passed in.
- Examples use constructor injection; no decorators, no DI container.
- Every diagram is Mermaid and renders on GitHub, GitLab, and VS Code.
- Each chapter ends with an exercise and links to the next chapter.

### Source mapping

[`../notes.md`](../notes.md) remains the canonical one-page summary. Chapters 1–5
expand sections §1–§10:

| Chapter | Expands |
| --- | --- |
| 1 | §1 (problem), the Theory preamble |
| 2 | §2 (structure), §4 (related ideas) |
| 3 | §3.1–3.5 (implementation) |
| 4 | §3.5 (Express usage), §5 (production) |
| 5 | §5–§10 (production, mistakes, relationships, checklist) |

If a chapter and the summary disagree, treat the chapter as the detailed
explanation and update both.
