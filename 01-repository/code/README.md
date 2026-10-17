# Repository Pattern — Demo API

A runnable Express + TypeScript implementation of the pattern described in
[`../notes.md`](../notes.md) and the [chapter notes](../notes/README.md).

The point of the demo is the **seam**, not the framework:

```text
OrderService ──depends on──> OrderRepository (interface)
                                   ▲
                    ┌──────────────┴──────────────┐
       PrismaOrderRepository            InMemoryOrderRepository
          (PostgreSQL)                        (tests / no-DB mode)
```

The service never imports Prisma. The same test suite runs against both
adapters.

## Quick start (no database required)

```bash
cd 01-repository/code
npm install
npm run dev
```

Defaults: `REPOSITORY=memory`, three demo orders seeded, API on
<http://localhost:3000>.

```bash
# list a user's orders
curl "http://localhost:3000/orders?userId=usr_1&limit=1"

# read one order
curl http://localhost:3000/orders/ord_demo_1

# cancel a pending order (204)
curl -i -X POST http://localhost:3000/orders/ord_demo_1/cancel

# paid order -> 409 Conflict
curl -i -X POST http://localhost:3000/orders/ord_demo_2/cancel

# create an order
curl -X POST http://localhost:3000/orders \
  -H "content-type: application/json" \
  -d '{"userId":"usr_1","totalCents":2500}'
```

## PostgreSQL mode

```bash
cp .env.example .env
npm run db:up          # postgres:16 on localhost:5433
npm run db:push        # create the schema
npm run db:seed        # insert the demo orders
npm run dev:postgres   # REPOSITORY=postgres
```

`docker compose down` stops the database; add `-v` to delete its volume.

## Endpoints

| Method | Path | Purpose | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Liveness | `200` | — |
| `GET` | `/orders?userId=&limit=&cursor=` | Paginated list for a user | `200` | `400` |
| `GET` | `/orders/:id` | Read one order | `200` | `404` |
| `POST` | `/orders` | Create a pending order | `201` | `400` |
| `POST` | `/orders/:id/cancel` | Cancel a pending order | `204` | `404`, `409` |

Errors are JSON: `400` validation, `404` unknown order, `409` illegal state
transition, `500` persistence failure.

## Folder structure

This demo uses the **layer-first** variant from the notes (a single module does
not benefit from a `modules/` wrapper). The chapter snippets map 1:1:

```text
src/
├── domain/                       # no Prisma, no Express
│   ├── order.ts                  # entity + status union
│   ├── order.repository.ts       # the interface (port)
│   └── errors.ts                 # domain errors
├── application/
│   └── order.service.ts          # business rules only
├── infrastructure/
│   ├── prisma.ts                 # one PrismaClient
│   ├── order.mapper.ts           # row <-> domain
│   ├── prisma-order.repository.ts
│   └── in-memory-order.repository.ts
├── http/
│   ├── orders.routes.ts          # URL -> controller
│   ├── orders.controller.ts      # HTTP in/out
│   ├── order.dto.ts              # zod schemas + response mapper
│   ├── async-handler.ts
│   └── error-handler.ts          # domain errors -> status codes
├── config/env.ts
├── composition-root.ts           # chooses memory or Prisma
├── app.ts                        # createApp(service)
└── server.ts                     # listen + graceful shutdown
```

Dependency direction: `http → application → domain` and
`infrastructure → domain`. Nothing in `domain` imports outward.

## Where each idea is explained

| File | Chapter |
| --- | --- |
| `domain/order.repository.ts` | [3 — interface design](../notes/03-domain-model-and-interface.md) |
| `infrastructure/prisma-order.repository.ts` | [4 — Prisma adapter](../notes/04-prisma-adapter.md) |
| `application/order.service.ts`, `http/` | [5 — service and Express wiring](../notes/05-service-and-express-wiring.md) |
| `tests/` | [6 — testing](../notes/06-testing.md) |
| `composition-root.ts` | [2 — boundaries](../notes/02-concept-and-boundaries.md) |

## Tests

```bash
npm test          # unit + contract + HTTP integration
npm run typecheck
```

What runs:

- `tests/unit/order.service.test.ts` — business rules with a fake, no database.
- `tests/contract/order.repository.contract.ts` — one suite, run against the
  in-memory adapter (and optionally PostgreSQL).
- `tests/integration/orders.api.test.ts` — Supertest against `createApp()`,
  covering `200/201/204/400/404/409` and cursor pagination.

Optional PostgreSQL contract run:

```bash
docker exec -it repository-demo-db createdb -U demo repository_demo_test
DATABASE_URL="postgresql://demo:demo@localhost:5433/repository_demo_test?schema=public" \
  npx prisma db push
TEST_DATABASE_URL="postgresql://demo:demo@localhost:5433/repository_demo_test?schema=public" \
  npm test
```

Without `TEST_DATABASE_URL`, the Prisma suite is skipped so the default test run
needs no infrastructure.

## Deliberate simplifications

- No authentication or authorization; `userId` comes from the query/body.
- Cancellation is a single write, so no transaction/outbox (chapter 7).
- No optimistic locking; two concurrent cancels both succeed.
- Money is stored as integer cents.
- The in-memory adapter is intentionally small; it is not a full SQL emulator.

These are called out because the notes describe the production versions.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with the in-memory adapter |
| `npm run dev:postgres` | Start with Prisma + PostgreSQL |
| `npm run build` / `start` | Compile to `dist/` and run |
| `npm test` | Vitest (unit, contract, HTTP) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | Docker Compose database |
| `npm run db:push` / `db:seed` | Schema + demo data |
| `npm run db:studio` | Prisma Studio |
