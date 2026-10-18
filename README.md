# Backend Design Patterns

**Ten production-focused backend patterns, each with notes and TypeScript examples — plus an AI-ready reference architecture that composes all of them into a project-start blueprint.**

TypeScript · Node.js · Express · NestJS · PostgreSQL · Prisma · Redis · message queues · LLM providers

> 🧭 **Starting a new backend?** Read the
> [AI-ready project blueprint](11-ai-ready-blueprint/notes.md) first. It shows how
> the ten patterns fit together in one deployable, and adds the AI subsystem every
> product now needs. The pattern folders below remain the deep references.
>
> 📖 **Learning the patterns end to end?** Start with the
> [master guide](notes.md), or jump straight to
> [Pattern 1 — Repository](01-repository/notes.md).

---

## Contents

- [What this repository is](#what-this-repository-is)
- [Quick start](#quick-start)
- [The patterns at a glance](#the-patterns-at-a-glance)
- [How the material is organised](#how-the-material-is-organised)
- [The AI-ready blueprint](#the-ai-ready-blueprint)
- [Repository layout](#repository-layout)
- [Reading order](#reading-order)
- [Conventions](#conventions)
- [Status and roadmap](#status-and-roadmap)

## What this repository is

A working reference, not a pattern encyclopedia. Every pattern answers four
questions before showing code:

1. **What problem does it solve?**
2. **When is it worth the cost?**
3. **How does it look in a real TypeScript service?**
4. **What breaks in production, and how do you test it?**

The code favours explicit composition over framework magic: constructor
injection, a single composition root, ports at the boundary, and adapters at the
edge. The same shapes appear in the AI subsystem — an LLM is treated as one more
unreliable, metered external dependency.

**What you will not find:** pattern trivia, UML for its own sake, or "use every
pattern everywhere" advice. Each folder says when *not* to use the pattern.

## Quick start

Requires **Node.js 20+** and npm. No database, cloud account, or API key is
needed for the runnable demos.

```bash
git clone https://github.com/Amie-dev/Backend-Design-Patterns.git
cd Backend-Design-Patterns/01-repository/code
npm install
npm run dev
```

```bash
# in a second terminal, while the server runs
curl "http://localhost:3000/orders?userId=usr_1&limit=1"

# run the test suite (unit + contract + HTTP)
npm test
```

Each demo folder has its own `README.md` with endpoints, environment variables,
and the exact behaviour to observe:

| Demo | Port | Infrastructure | Start with | Notes |
| --- | --- | --- | --- | --- |
| [Repository](01-repository/code/README.md) | `3000` | In-memory by default; PostgreSQL via Docker | `npm run dev` | `REPOSITORY=postgres npm run dev` after `npm run db:up && npm run db:push && npm run db:seed` |
| [Factory](02-factory/code/README.md) | `3200` | Sandbox provider; Stripe/Razorpay optional | `npm run dev` | `PAYMENTS_ENABLED=stripe` needs keys; contract tests run against all |
| [Singleton](03-singleton/code/README.md) | `3000` | None | `cp .env.example .env && npm run dev` | Bounded pool, TTL cache, request scope, graceful shutdown |

> 01 and 03 both default to port `3000`; run them one at a time or set `PORT`.

## The patterns at a glance

| # | Pattern | Category | What it removes |
| --- | --- | --- | --- |
| 1 | [Repository](01-repository/notes.md) | Data access | Database queries and ORM types leaking into business rules |
| 2 | [Factory](02-factory/notes.md) | Object creation | Scattered `new VendorClient()` and provider selection logic |
| 3 | [Singleton](03-singleton/notes.md) | Shared instance lifecycle | Duplicated pools, configs, and clients with no owner or shutdown |
| 4 | [Strategy](04-strategy/notes.md) | Business logic and extensibility | Growing `if (plan === …)` chains and hard-coded algorithms |
| 5 | [Observer](05-observer/notes.md) | Events and notifications | Side effects fired inline, lost on crash, or double-published |
| 6 | [Builder](06-builder/notes.md) | Complex object construction | Twelve-argument constructors and partially valid objects |
| 7 | [Adapter](07-adapter/notes.md) | External integrations | Vendor SDK types and error shapes crossing into the core |
| 8 | [Decorator](08-decorator/notes.md) | Cross-cutting behaviour | Copy-pasted retry, caching, logging, and metrics wrappers |
| 9 | [CQRS](09-cqrs/notes.md) | Read/write architecture | One model carrying both reporting load and write invariants |
| 10 | [Circuit Breaker](10-circuit-breaker/notes.md) | Reliability | A failing dependency consuming every connection and thread |
| 11 | [AI-Ready Blueprint](11-ai-ready-blueprint/notes.md) | Reference architecture | Ten patterns learned separately but never composed into a project structure |

**Status of each folder:**

| Folder | `notes.md` | Chapter notes (`notes/`) | Runnable demo (`code/`) |
| --- | --- | --- | --- |
| 01 Repository | ✅ | 10 chapters | ✅ in-memory + Prisma |
| 02 Factory | ✅ | 5 chapters | ✅ sandbox + Stripe + Razorpay |
| 03 Singleton | ✅ | 5 chapters | ✅ pool + cache + shutdown |
| 04 Strategy | ✅ | — | — |
| 05 Observer | ✅ | — | — |
| 06 Builder | ✅ | — | — |
| 07 Adapter | ✅ | — | — |
| 08 Decorator | ✅ | — | — |
| 09 CQRS | ✅ | — | — |
| 10 Circuit Breaker | ✅ | — | — |
| 11 Blueprint | ✅ | — | planned |

## How the material is organised

Each pattern folder is self-contained and exposes the same three levels of depth,
so you can stop at whatever level you need. A fourth level, the master guide,
spans the whole repository.

### 1. `notes.md` — the one-page reference

The ten pattern folders follow the same spine: **Theory → Why you need it →
Benefits → When this pattern applies → numbered implementation sections →
production considerations → common mistakes → relationship to other patterns →
practice checklist → one-line takeaway.** Read this when you need a decision, a
code shape, or a refresher before a design review.

### 2. `notes/` — chapter-wise deep dives

Long-form chapters that expand the reference with reasoning, copy-ready code,
tests, failure modes, and production checklists. Each folder's `notes/README.md`
is the index, with suggested reading paths. Currently available for
[Repository](01-repository/notes/README.md) (10 chapters),
[Factory](02-factory/notes/README.md) (5), and
[Singleton](03-singleton/notes/README.md) (5).

### 3. `code/` — runnable demos

Complete Express + TypeScript APIs with unit, contract, integration, and HTTP
tests. The point is always the **seam**, not the framework: the demo shows the
same test suite passing against a fake and a real adapter.

### 4. `notes.md` at the repository root

A single-file master guide: the common e-commerce problem, a chapter for each of
the ten patterns, and a closing section on how they combine. Useful for a linear
read or for searching one document.

## The AI-ready blueprint

[`11-ai-ready-blueprint/notes.md`](11-ai-ready-blueprint/notes.md) is the folder
to read before starting a project. Rather than adding an eleventh pattern, it
composes the other ten into one structure and extends it with an AI subsystem
built from the same building blocks:

- **Adapter** for each LLM provider; no SDK type crosses the port.
- **Strategy** for model routing (task + plan + budget → model).
- **Decorator** for the cross-cutting stack: guardrails → cache → cost meter →
  breaker → retry → timeout → adapter.
- **Circuit Breaker** per provider *and* model; **Observer/outbox** for usage
  events; **CQRS** where read and write load diverge.

It uses conventional layer folders, with `<feature>.<role>.ts` file naming:

```text
src/
├── config/          # parsed once at boot; fail fast
├── routes/          # URL + middleware → controller
├── controllers/     # validate, call one service, map the result
├── middlewares/     # auth, tenancy, rate limits, request id
├── services/        # use cases and policy
├── domain/          # entities, value objects, invariants — pure
├── ports/           # interfaces the inside owns
├── repositories/    # persistence adapters
├── providers/       # vendor adapters (payments, email, LLM)
├── tools/           # model-callable tools; call services, never repositories
├── prompts/         # versioned prompt registry
├── dtos/            # transport shapes
├── errors/          # typed errors + one HTTP mapper
├── lib/             # small pure helpers
├── jobs/            # queue workers and the outbox relay
└── container.ts     # the only composition root
```

The rules it defends in review and CI: dependencies point inward, one
composition root, no network call inside a database transaction, idempotency for
retryable writes, model output is untrusted input, tools are allowlisted and
audited, prompts are versioned and gated by evals, and every run carries a
token/cost/time budget. A dependency-cruiser configuration is included to
enforce the import boundaries mechanically.

## Repository layout

```text
.
├── README.md                     # this file
├── notes.md                      # master guide: all ten patterns end to end
├── 01-repository/
│   ├── notes.md                  # one-page reference
│   ├── notes/                    # 10 chapter deep dive (README.md indexes them)
│   └── code/                     # Express + TS demo (in-memory | Prisma)
├── 02-factory/
│   ├── notes.md
│   ├── notes/                    # 5 chapters
│   └── code/                     # sandbox | Stripe | Razorpay providers
├── 03-singleton/
│   ├── notes.md
│   ├── notes/                    # 5 chapters
│   └── code/                     # pool, cache, request scope, shutdown
├── 04-strategy/ … 10-circuit-breaker/
│   ├── notes.md                  # complete reference
│   ├── notes/                    # reserved for chapters
│   └── code/                     # reserved for demos
└── 11-ai-ready-blueprint/
    └── notes.md                  # composition of patterns 1–10 + AI subsystem
```

## Reading order

**Learning the patterns:** numeric order, 1 → 10. Each folder assumes only the
ones before it.

**Shipping a new AI product:** read in the order you need them (from the
blueprint):

| Order | Read | Before you build |
| --- | --- | --- |
| 1 | [Adapter](07-adapter/notes.md) | The first external integration or LLM provider |
| 2 | [Decorator](08-decorator/notes.md) | Caching, logging, guardrails, retries, cost metering |
| 3 | [Repository](01-repository/notes.md) | The first aggregate and its persistence port |
| 4 | [Strategy](04-strategy/notes.md) | Model routing or rules that vary by plan |
| 5 | [Circuit Breaker](10-circuit-breaker/notes.md) | The first dependency that can fail slowly |
| 6 | [Observer](05-observer/notes.md) | The first side effect that must survive a crash |
| 7 | [CQRS](09-cqrs/notes.md) | Reporting or read traffic competing with writes |
| 8 | [Factory](02-factory/notes.md) | Provider or adapter selection from configuration |
| 9 | [Builder](06-builder/notes.md) | Prompt/context assembly with defaults and validation |
| 10 | [Singleton](03-singleton/notes.md) | Pools, clients, config, and shutdown ownership |

## Conventions

- **TypeScript, Node.js 20+, Express** in every demo; NestJS appears only as an
  alternative in the notes. Vitest for tests, zod for validation, `tsx` for dev.
- **Ports and adapters:** interfaces live inside (`ports/`, `domain/`), concrete
  technology lives outside (`repositories/`, `providers/`), and only
  `container.ts` / `composition-root.ts` constructs it.
- **Diagrams** are Mermaid fenced blocks; **code** is fenced with a language tag;
  links are relative so the repository works offline and on GitHub.
- **Chapter notes** follow `NN-topic.md` naming and are indexed by a folder
  `README.md` with a chapter table and suggested reading paths.
- **Blueprints** (folder 11) use conventional layer folders and
  `<feature>.<role>.ts` file names, e.g. `orders.controller.ts`,
  `refund-order.service.ts`, `llm.port.ts`.

## Status and roadmap

- **01–03** are complete: reference, chapters, and a tested demo.
- **04–10** have complete `notes.md` references; chapter notes and runnable
  demos are the next additions.
- **11** is a complete written blueprint; a starter `code/` scaffold is planned
  (Express + TypeScript, `FakeLlm` adapter, sample tests).
- **Corrections and additions are welcome** — keep the existing spine, link
  relative, and make sure any new code runs with `npm test`.

## License

No license file is included yet. The material is published for learning; add a
`LICENSE` before redistributing or using it commercially.
