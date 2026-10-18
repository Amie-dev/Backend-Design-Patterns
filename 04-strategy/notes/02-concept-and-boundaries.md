# Chapter 2 — The Strategy Concept and Its Boundaries

> Companion to [`../notes.md`](../notes.md) · Sections 2 and 4
> **Learning goals:** name the three roles, design a context and a contract that
> can survive new rules, choose where selection lives, and tell strategy apart
> from the patterns it is usually confused with.

## 2.1 The three roles

Every strategy implementation has three parts, whether or not they are separate
files:

| Role | Responsibility | Knows about | Must not know |
| --- | --- | --- | --- |
| **Context** | The data the algorithm needs | Domain values | Strategies, HTTP, database |
| **Strategy** | One algorithm behind a shared contract | Its own rule | Other strategies, selection, infrastructure |
| **Selector** | Decide which strategy applies | All strategies, policy source | How any algorithm computes |

The source notes show them as a registry between the service and the
implementations:

```mermaid
flowchart TD
    CO["CheckoutService<br/>(context owner)"] -->|1. resolve(policy)| REG["DiscountStrategyRegistry<br/>(selector)"]
    REG -->|2. returns| I["DiscountStrategy<br/>calculate(context)"]
    P["PremiumDiscount"] -.->|implements| I
    S["StudentDiscount"] -.->|implements| I
    F["FestivalDiscount"] -.->|implements| I
    N["NoDiscount"] -.->|implements| I
    CO -->|3. calculate(context)| I
```

The service owns the workflow. The selector owns the decision. The strategy owns
the computation. An implementation that merges selector and strategy is not
wrong TypeScript — it is simply the original `if` chain with extra files, and it
will grow the same way.

## 2.2 The context object

Passing loose arguments is the first thing to fix:

```ts
// Avoid: every new field changes every implementation
calculate(amount: number, customerType: string, productIds: string[], now: Date): number;
```

Add currency, region, or a loyalty tier and every implementation signature
changes. Pass one object instead:

```ts
export type Currency = "INR" | "USD" | "EUR";
export type CustomerType = "guest" | "student" | "premium";

export type DiscountContext = {
  /** Cart subtotal in the smallest currency unit (paise/cents). */
  readonly amount: number;
  readonly currency: Currency;
  readonly customerType: CustomerType;
  readonly productIds: readonly string[];
  /** Injected so strategies stay deterministic and testable. */
  readonly now: Date;
};
```

Three details matter:

1. **`readonly` is documentation.** A strategy that mutates the context will
   surprise its caller; the type makes that visible.
2. **Context is data, not services.** Never pass a repository, a logger, or a
   config object. If a strategy needs an external lookup, it is not pure and the
   design should change (see 2.3).
3. **Context is assembled by the service**, from data it already trusts. The
   strategy does not fetch the customer profile.

## 2.3 Designing the contract

```ts
export type DiscountKey = "premium" | "student" | "festival" | "none";

export interface DiscountStrategy {
  /** Stable identifier used for selection, logs, and metrics. */
  readonly key: DiscountKey;
  /** Discount in minor units; always 0 <= result <= context.amount. */
  calculate(context: DiscountContext): number;
}
```

Decisions worth making explicitly:

| Decision | Recommendation | Why |
| --- | --- | --- |
| Return value | Return the discount, do not mutate the cart | Pure functions are trivially testable and cacheable |
| Units | Return minor units (integers) | Floats drift; `19.99 * 0.15` is not exact |
| Method name | Domain verb (`calculate`, `price`, `authorize`) | `execute()` hides intent and invites unrelated rules |
| `key` source | Code constant, never a raw request string | Prevents user-controlled strategy selection |
| `key` type | Narrow union or enum | Exhaustiveness checks in the registry |
| Errors | Throw domain errors for invalid input; never return `NaN` | A missing discount is `0`, not an accident |
| Sync or async | Prefer synchronous | Async strategies usually hide I/O that belongs outside |
| Extra output | Return a richer result only if audit needs a reason | `{ amount, reason }` beats logging inside the strategy |

If the business needs to explain a discount to a customer, extend the return type
rather than the interface surface:

```ts
export type DiscountResult = {
  readonly amount: number;
  readonly reason: string; // "Premium 15%", "Festival ₹100 off"
};

export interface DiscountStrategy {
  readonly key: DiscountKey;
  calculate(context: DiscountContext): DiscountResult;
}
```

Now the explanation is data, testable and loggable, instead of a side effect.

## 2.4 Interface or plain function?

A strategy with one method and no collaborators does not need a class:

```ts
export type DiscountStrategy = (context: DiscountContext) => number;

export const premiumDiscount: DiscountStrategy = ({ amount }) =>
  Math.round(amount * 0.15);
```

| Approach | Use when | Trade-off |
| --- | --- | --- |
| **Function type** | One operation, no state, no key needed for selection | No `key`, no `instanceof`, harder to extend later |
| **Interface + class** | Constructor configuration (fixed amount, excluded IDs), multiple methods, DI-friendly | More ceremony per rule |
| **Abstract class** | A fixed skeleton with overridable steps (template method) | Inheritance limits composition |

The registry decides the shape. If it maps a key to a value, a function is enough:

```ts
const strategies: Record<DiscountKey, DiscountStrategy> = {
  premium: premiumDiscount,
  student: studentDiscount,
  none: noDiscount,
};
```

If a rule is parameterised — a festival promotion with a configurable amount and
exclusion list — a class keeps the parameters in the constructor instead of in a
closure factory:

```ts
export class FestivalDiscount implements DiscountStrategy {
  readonly key = "festival" as const;

  constructor(
    private readonly fixedAmount: number,
    private readonly excludedProductIds: ReadonlySet<string>,
  ) {}

  calculate({ amount, productIds }: DiscountContext): number {
    if (productIds.some((id) => this.excludedProductIds.has(id))) return 0;
    return Math.min(this.fixedAmount, amount);
  }
}
```

Do not create a class "for consistency" if a function suffices; do not use a
function if the rule needs validated constructor state.

## 2.5 Where selection lives

There are four legitimate homes for "which strategy applies":

| Home | Shape | Use when | Example |
| --- | --- | --- | --- |
| **Registry** | `Map` / `Record` from key to strategy | The policy is already resolved to a key | `registry.resolve(policy)` |
| **Policy resolver (service)** | `async resolvePolicy(userId, cart)` | Selection needs customer, promotion, or flag data | `PricingService` |
| **Factory** | `create(config)` returns a strategy | The strategy must be parameterised at creation | `new FestivalDiscount(amount, exclusions)` |
| **DI / composition root** | One implementation bound for the whole app | The algorithm varies by deployment, not by request | A tax engine per country |

Most real systems use two of them: a **policy resolver** that loads data, and a
**registry** that turns the resolved policy into an object. The registry stays
synchronous and pure:

```ts
export type DiscountPolicy =
  | { kind: "none" }
  | { kind: "premium" }
  | { kind: "student" }
  | { kind: "festival"; fixedAmount: number; excludedProductIds: string[] };

function assertNever(value: never): never {
  throw new Error(`Unhandled discount policy: ${JSON.stringify(value)}`);
}

export class DiscountStrategyRegistry {
  constructor(
    private readonly premium: DiscountStrategy,
    private readonly student: DiscountStrategy,
    private readonly none: DiscountStrategy,
  ) {}

  resolve(policy: DiscountPolicy): DiscountStrategy {
    switch (policy.kind) {
      case "premium":
        return this.premium;
      case "student":
        return this.student;
      case "festival":
        return new FestivalDiscount(
          policy.fixedAmount,
          new Set(policy.excludedProductIds),
        );
      case "none":
        return this.none;
      default:
        return assertNever(policy);
    }
  }
}
```

`assertNever` is the difference between "we forgot a case" at compile time and a
silent `undefined` at 2 a.m. If a new policy kind is added, the build fails until
the registry handles it.

What must **not** happen: the controller reading `req.body.customerType` and
choosing a strategy. That is the original conditional, relocated to the place
with the least validation.

## 2.6 Strategy and its neighbours

| Pattern / concept | What varies | Who decides | Typical confusion |
| --- | --- | --- | --- |
| **Strategy** | The algorithm behind one interface | Caller or selector, at runtime | "It's just a function" — yes, often |
| **Factory** | Which object is created | Caller supplies a key/config | A factory may *create* a strategy; it does not compute |
| **Template method** | Steps inside a fixed algorithm | Base class calls overridable hooks | Uses inheritance; strategy uses composition |
| **State** | Behaviour by internal state | The object transitions itself | Strategy selection is external and stateless |
| **Policy object** | The parameters of a rule | Loaded from config/DB | Policy is data; strategy is behaviour |
| **Chain of responsibility** | Who handles the request | Each handler passes or stops | A chain may try several; a strategy computes once |
| **Command** | A request as an object | Invoker queues/executes it | Command captures *what to do*; strategy captures *how* |

**Factory vs strategy.** The factory answers "how do I build this?"; the strategy
answers "how does this behave?". A payment provider factory returns objects that
implement a provider interface — those objects may themselves use strategies for
retry or fee calculation.

**State vs strategy.** A state object changes its own successor
(`order.pay()` moves to `paid`); a strategy is chosen from outside and does not
remember the previous call. If the object must know its history, it is state.

**Policy vs strategy.** This is the most common source of accidental
over-engineering:

```ts
// Data: the rule is a row in a table
const rates: Record<Region, number> = { IN: 0.18, US: 0.07, EU: 0.2 };
const tax = Math.round(amount * rates[region]);

// Behaviour: the computation differs, not just the rate
interface TaxStrategy {
  calculate(context: TaxContext): number;
}

class InclusiveTax implements TaxStrategy { /* price includes tax */ }
class ExclusiveTax implements TaxStrategy { /* tax added at checkout */ }
```

If a new requirement only changes a number, change the table. If it changes the
shape of the computation, add a strategy.

## 2.7 Two ways the pattern degenerates

### The switch moved into a base class

```ts
abstract class DiscountStrategy {
  calculate(context: DiscountContext): number {
    switch (this.kind) {
      case "premium": return Math.round(context.amount * 0.15);
      case "student": return Math.round(context.amount * 0.1);
      default: return 0;
    }
  }

  protected abstract get kind(): string;
}
```

This is the original function with a class around it, plus inheritance. The
conditional still changes for every rule, and there is now a base class to fight.
The fix is one class per branch and a selector — exactly what the pattern says.

### The selector moved into the controller

```ts
// checkout.controller.ts — do not do this
const strategy =
  req.body.customerType === "premium"
    ? new PremiumDiscount()
    : req.body.customerType === "student"
      ? new StudentDiscount()
      : new NoDiscount();

const total = strategy.calculate({
  amount: req.body.amount,
  customerType: req.body.customerType,
  productIds: req.body.productIds,
  now: new Date(),
});
```

Four problems at once: the client controls the rule, the amount comes from the
request instead of the cart, `new Date()` makes the result non-deterministic, and
the controller now knows every implementation. The route should pass an
authenticated user id and a cart reference to a service; the service resolves the
policy from trusted data.

## 2.8 Is this really a strategy?

Run this before adding a folder of classes:

- [ ] Are there **at least three** interchangeable algorithms, or a realistic path
      to three?
- [ ] Do the algorithms differ in **computation**, not only in a constant?
- [ ] Can the chosen algorithm be **decided at runtime** from trusted data?
- [ ] Does the caller only need the result, not knowledge of which rule ran?
- [ ] Can each implementation be **pure** (or depend only on constructor state)?
- [ ] Is selection going to live in **one** place?

If the answers are "two algorithms", "only the percentage changes", or "the
caller needs to know which rule ran", a table, a function, or an explicit branch
is a better fit.

## Exercise

1. Take the `if/else` you identified in chapter 1 and write its context object.
   Include `now` and currency even if the current code does not use them — the
   point is to see what the algorithm actually depends on.
2. Decide whether each rule is a **strategy** or a **policy row**. Justify in one
   sentence per rule.
3. Sketch the selector: which data does it need, and is that data trusted? If it
   comes from the request body, name the source that should replace it.
4. Write the contract with a narrow `key` union, then a registry with
   `assertNever`. Confirm the build fails when you add a policy kind without a
   case.

---

**Previous:** [Chapter 1 ←](01-why-strategy.md)
**Next:** [Chapter 3 — Discount strategies, end to end →](03-discount-strategies.md)
**Index:** [Strategy notes](README.md) · **Source:** [`../notes.md`](../notes.md)
