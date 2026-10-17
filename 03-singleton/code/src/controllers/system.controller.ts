import { setTimeout as delay } from "node:timers/promises";
import type { RequestHandler } from "express";
import type { Config } from "../config/env";
import type { TtlCache } from "../infrastructure/cache";
import type { DatabasePool } from "../infrastructure/database";
import type { MetricsRegistry } from "../lib/metrics";
import { currentRequestContext } from "../lib/request-context";
import type { RuntimeState } from "../lib/runtime";
import { asyncHandler } from "../middlewares/async-handler";

export type SystemDependencies = {
  config: Config;
  pool: DatabasePool;
  cache: TtlCache;
  metrics: MetricsRegistry;
  runtime: RuntimeState;
};

export class SystemController {
  constructor(private readonly deps: SystemDependencies) {}

  /** Liveness: no dependency checks. */
  health: RequestHandler = (_req, res) => {
    res.json({
      status: "ok",
      instanceId: this.deps.runtime.instanceId,
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
    });
  };

  /** Readiness: can this process serve traffic right now? */
  ready: RequestHandler = asyncHandler(async (_req, res) => {
    this.refreshGauges();

    if (this.deps.runtime.shuttingDown) {
      res.status(503).json({ status: "draining" });
      return;
    }

    if (this.deps.pool.isClosed) {
      res.status(503).json({ status: "not_ready", reason: "pool_closed" });
      return;
    }

    const latencyMs = await this.deps.pool.ping();
    res.json({ status: "ready", poolLatencyMs: latencyMs });
  });

  /**
   * The singleton evidence: ids and counters are stable for the lifetime of
   * this process. Compare two calls, then run a second replica and compare.
   */
  info: RequestHandler = (_req, res) => {
    this.refreshGauges();

    const pool = this.deps.pool.stats();
    const cache = this.deps.cache.stats();
    const context = currentRequestContext();

    res.json({
      instanceId: this.deps.runtime.instanceId,
      pid: process.pid,
      startedAt: this.deps.runtime.startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      requestsServed: this.deps.runtime.requestsServed,
      environment: this.deps.config.nodeEnv,
      settings: {
        dbPoolSize: this.deps.config.dbPoolSize,
        dbQueryDelayMs: this.deps.config.dbQueryDelayMs,
        cacheTtlMs: this.deps.config.cacheTtlMs,
        seedDemo: this.deps.config.seedDemo,
      },
      components: {
        database: {
          id: pool.id,
          scope: "process",
          poolSize: pool.size,
          inUse: pool.inUse,
        },
        cache: {
          id: cache.id,
          scope: "process",
          entries: cache.entries,
        },
        metrics: {
          id: this.deps.metrics.id,
          scope: "process",
        },
      },
      requestContext: context
        ? {
            requestId: context.requestId,
            tenantId: context.tenantId,
            userId: context.userId,
          }
        : null,
    });
  };

  /**
   * Echo the request scope after an optional delay. Two concurrent calls
   * with different headers must never exchange values.
   */
  context: RequestHandler = asyncHandler(async (req, res) => {
    const requested = Number(req.query.delayMs ?? 0);
    const delayMs = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 0), 250)
      : 0;

    if (delayMs > 0) await delay(delayMs);

    const context = currentRequestContext();
    res.json({
      requestId: context.requestId,
      tenantId: context.tenantId,
      userId: context.userId,
      startedAt: new Date(context.startedAt).toISOString(),
      instanceId: this.deps.runtime.instanceId,
      scope: "request",
    });
  });

  pool: RequestHandler = (_req, res) => {
    this.refreshGauges();
    res.json(this.deps.pool.stats());
  };

  cacheStats: RequestHandler = (_req, res) => {
    this.refreshGauges();
    res.json(this.deps.cache.stats());
  };

  prometheus: RequestHandler = (_req, res) => {
    this.refreshGauges();
    res.type("text/plain; version=0.0.4").send(this.deps.metrics.render());
  };

  private refreshGauges(): void {
    const pool = this.deps.pool.stats();
    const cache = this.deps.cache.stats();

    this.deps.metrics.setGauge("db_pool_in_use", pool.inUse, {
      pool: pool.id,
    });
    this.deps.metrics.setGauge("db_pool_size", pool.size, { pool: pool.id });
    this.deps.metrics.setGauge("db_pool_waiting", pool.waiting, {
      pool: pool.id,
    });
    this.deps.metrics.setGauge("cache_entries", cache.entries, {
      cache: cache.id,
    });
  }
}
