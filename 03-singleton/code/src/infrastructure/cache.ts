import { randomUUID } from "node:crypto";

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

export type CacheStats = {
  id: string;
  entries: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  expirations: number;
  evictions: number;
  ttlMs: number;
  maxEntries: number;
  closed: boolean;
};

export type TtlCacheOptions = {
  ttlMs: number;
  maxEntries?: number;
  id?: string;
  now?: () => number;
};

/**
 * One TTL cache per process. It is intentionally not a distributed cache:
 * replicas do not see each other's entries (see `README.md`).
 */
export class TtlCache {
  readonly id: string;
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private expirations = 0;
  private evictions = 0;
  private closed = false;

  constructor(options: TtlCacheOptions) {
    if (!Number.isInteger(options.ttlMs) || options.ttlMs < 0) {
      throw new Error("cache ttlMs must be a non-negative integer");
    }

    this.id = options.id ?? `cache_${randomUUID().slice(0, 8)}`;
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 1_000;
    this.now = options.now ?? Date.now;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get<T>(key: string): T | undefined {
    if (this.closed) return undefined;

    const entry = this.entries.get(key);

    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      this.expirations += 1;
      this.misses += 1;
      return undefined;
    }

    this.hits += 1;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.ttlMs): void {
    if (this.closed || ttlMs <= 0) return;

    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
        this.evictions += 1;
      }
    }

    this.entries.set(key, {
      value,
      expiresAt: this.now() + ttlMs,
    });
    this.sets += 1;
  }

  delete(key: string): boolean {
    const deleted = this.entries.delete(key);
    if (deleted) this.deletes += 1;
    return deleted;
  }

  /** Invalidate every key with a prefix, used after a write. */
  deleteByPrefix(prefix: string): number {
    let removed = 0;

    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        this.deletes += 1;
        removed += 1;
      }
    }

    return removed;
  }

  clear(): void {
    this.entries.clear();
  }

  close(): void {
    this.closed = true;
    this.entries.clear();
  }

  stats(): CacheStats {
    this.prune();

    return {
      id: this.id,
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      expirations: this.expirations,
      evictions: this.evictions,
      ttlMs: this.ttlMs,
      maxEntries: this.maxEntries,
      closed: this.closed,
    };
  }

  private prune(): void {
    const now = this.now();

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        this.expirations += 1;
      }
    }
  }
}
