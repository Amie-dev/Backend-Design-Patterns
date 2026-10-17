import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { PoolClosedError, PoolTimeoutError } from "../errors/app.errors";

export type PooledConnection = {
  readonly id: string;
  readonly slot: number;
};

export type PoolStats = {
  id: string;
  size: number;
  inUse: number;
  available: number;
  waiting: number;
  acquiredTotal: number;
  releasedTotal: number;
  timedOutTotal: number;
  rejectedTotal: number;
  maxObservedInUse: number;
  queryDelayMs: number;
  acquireTimeoutMs: number;
  closed: boolean;
};

export type DatabasePoolOptions = {
  size: number;
  queryDelayMs?: number;
  acquireTimeoutMs?: number;
  drainTimeoutMs?: number;
  id?: string;
};

type Waiter = {
  resolve: (connection: PooledConnection) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * A bounded, process-wide pool that simulates a database driver.
 *
 * It exists to make the singleton lifecycle observable:
 * - `size` is fixed at construction (one pool per process);
 * - every query acquires and releases a logical connection;
 * - `maxObservedInUse` can never exceed `size`;
 * - waiters time out instead of queueing forever;
 * - `close()` drains in-flight work and rejects queued callers.
 *
 * Replacing it with Prisma's pool means keeping the same composition-root
 * wiring and shutdown call.
 */
export class DatabasePool {
  readonly id: string;
  private readonly size: number;
  private readonly queryDelayMs: number;
  private readonly acquireTimeoutMs: number;
  private readonly drainTimeoutMs: number;
  private readonly waiters: Waiter[] = [];
  private readonly activeLeases = new Set<string>();

  private inUse = 0;
  private nextSlot = 1;
  private nextLease = 1;
  private acquiredTotal = 0;
  private releasedTotal = 0;
  private timedOutTotal = 0;
  private rejectedTotal = 0;
  private maxObservedInUse = 0;
  private closed = false;

  constructor(options: DatabasePoolOptions) {
    if (!Number.isInteger(options.size) || options.size < 1) {
      throw new Error("database pool size must be an integer >= 1");
    }

    this.id = options.id ?? `db_${randomUUID().slice(0, 8)}`;
    this.size = options.size;
    this.queryDelayMs = options.queryDelayMs ?? 0;
    this.acquireTimeoutMs = options.acquireTimeoutMs ?? 2_000;
    this.drainTimeoutMs = options.drainTimeoutMs ?? 5_000;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Acquire a lease, run work, always release — even when work throws. */
  async query<T>(
    fn: (connection: PooledConnection) => T | Promise<T>,
  ): Promise<T> {
    const connection = await this.acquire();

    try {
      if (this.queryDelayMs > 0) {
        await sleep(this.queryDelayMs);
      }
      return await fn(connection);
    } finally {
      this.release(connection);
    }
  }

  async acquire(): Promise<PooledConnection> {
    if (this.closed) {
      this.rejectedTotal += 1;
      throw new PoolClosedError(this.id);
    }

    if (this.inUse < this.size) {
      return this.grant();
    }

    return new Promise<PooledConnection>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);

          this.timedOutTotal += 1;
          reject(new PoolTimeoutError(this.id, this.acquireTimeoutMs));
        }, this.acquireTimeoutMs),
      };

      waiter.timer.unref?.();
      this.waiters.push(waiter);
    });
  }

  release(connection: PooledConnection): void {
    if (!this.activeLeases.delete(connection.id)) return;

    this.inUse = Math.max(0, this.inUse - 1);
    this.releasedTotal += 1;

    const waiter = this.waiters.shift();
    if (!waiter) return;

    clearTimeout(waiter.timer);
    waiter.resolve(this.grant());
  }

  /** Cheap dependency check for the readiness probe. */
  async ping(): Promise<number> {
    const startedAt = Date.now();
    await this.query(() => undefined);
    return Date.now() - startedAt;
  }

  /**
   * Stop accepting work, reject queued waiters, and wait (bounded) for
   * in-flight leases to finish. The HTTP server closes first in `server.ts`.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      clearTimeout(waiter.timer);
      this.rejectedTotal += 1;
      waiter.reject(new PoolClosedError(this.id));
    }

    const deadline = Date.now() + this.drainTimeoutMs;

    while (this.inUse > 0 && Date.now() < deadline) {
      await sleep(5);
    }
  }

  stats(): PoolStats {
    return {
      id: this.id,
      size: this.size,
      inUse: this.inUse,
      available: this.size - this.inUse,
      waiting: this.waiters.length,
      acquiredTotal: this.acquiredTotal,
      releasedTotal: this.releasedTotal,
      timedOutTotal: this.timedOutTotal,
      rejectedTotal: this.rejectedTotal,
      maxObservedInUse: this.maxObservedInUse,
      queryDelayMs: this.queryDelayMs,
      acquireTimeoutMs: this.acquireTimeoutMs,
      closed: this.closed,
    };
  }

  private grant(): PooledConnection {
    const connection: PooledConnection = {
      id: `${this.id}:lease-${this.nextLease++}`,
      slot: this.nextSlot,
    };

    this.nextSlot = (this.nextSlot % this.size) + 1;
    this.activeLeases.add(connection.id);
    this.inUse += 1;
    this.acquiredTotal += 1;
    this.maxObservedInUse = Math.max(this.maxObservedInUse, this.inUse);

    return connection;
  }
}
