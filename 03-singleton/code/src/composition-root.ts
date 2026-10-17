import { loadConfig, type Config } from "./config/env";
import { TtlCache } from "./infrastructure/cache";
import { DatabasePool } from "./infrastructure/database";
import { createLogger, type Logger } from "./lib/logger";
import { MetricsRegistry } from "./lib/metrics";
import { createRuntimeState, type RuntimeState } from "./lib/runtime";
import type { OrderRepository } from "./repositories/order.repository";
import { PooledOrderRepository } from "./repositories/pooled-order.repository";
import { seedOrders } from "./seed";
import { OrderService } from "./services/order.service";

export type ContainerDependencies = {
  logger?: Logger;
  metrics?: MetricsRegistry;
  pool?: DatabasePool;
  cache?: TtlCache;
  orders?: OrderRepository;
  clock?: () => Date;
  idFactory?: () => string;
};

export type Container = {
  config: Config;
  logger: Logger;
  metrics: MetricsRegistry;
  pool: DatabasePool;
  cache: TtlCache;
  orders: OrderRepository;
  orderService: OrderService;
  runtime: RuntimeState;
  shutdown: () => Promise<void>;
};

/**
 * The composition root is the only module that constructs infrastructure.
 * It runs once at boot; module scope gives the resulting graph one instance
 * per process. Nothing below this file reads `process.env`.
 */
export function createContainer(
  config: Config = loadConfig(),
  deps: ContainerDependencies = {},
): Container {
  const clock = deps.clock ?? (() => new Date());
  const logger =
    deps.logger ??
    createLogger(config.logLevel, {
      instanceId: config.instanceId,
      scope: "process",
    });
  const metrics = deps.metrics ?? new MetricsRegistry();
  const pool =
    deps.pool ??
    new DatabasePool({
      size: config.dbPoolSize,
      queryDelayMs: config.dbQueryDelayMs,
      acquireTimeoutMs: config.dbAcquireTimeoutMs,
    });
  const cache =
    deps.cache ??
    new TtlCache({
      ttlMs: config.cacheTtlMs,
      maxEntries: 1_000,
    });
  const orders = deps.orders ?? new PooledOrderRepository(pool);

  if (config.seedDemo && orders instanceof PooledOrderRepository) {
    orders.seed(seedOrders(clock()));
  }

  const orderService = new OrderService({
    orders,
    cache,
    metrics,
    logger,
    clock,
    idFactory: deps.idFactory,
  });
  const runtime = createRuntimeState(config.instanceId, clock);

  const ownsPool = deps.pool === undefined;
  const ownsCache = deps.cache === undefined;

  return {
    config,
    logger,
    metrics,
    pool,
    cache,
    orders,
    orderService,
    runtime,
    shutdown: async () => {
      runtime.shuttingDown = true;

      if (ownsCache) cache.close();
      if (ownsPool) await pool.close();

      logger.info("resources closed", {
        poolId: pool.id,
        cacheId: cache.id,
        poolClosed: pool.isClosed,
      });
    },
  };
}
