import { describe, expect, it } from "vitest";
import { TtlCache } from "../../src/infrastructure/cache";

function createCache(options: { ttlMs?: number; maxEntries?: number } = {}) {
  let now = 1_000_000;
  const cache = new TtlCache({
    ttlMs: options.ttlMs ?? 100,
    maxEntries: options.maxEntries,
    id: "cache_test",
    now: () => now,
  });

  return {
    cache,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("TtlCache", () => {
  it("returns a stored value on a hit", () => {
    const { cache } = createCache();
    cache.set("order:1", { id: "1" });

    expect(cache.get("order:1")).toEqual({ id: "1" });
    expect(cache.stats()).toMatchObject({ entries: 1, hits: 1, misses: 0 });
  });

  it("reports a miss for an unknown key", () => {
    const { cache } = createCache();

    expect(cache.get("missing")).toBeUndefined();
    expect(cache.stats()).toMatchObject({ misses: 1, hits: 0 });
  });

  it("expires entries lazily by TTL", () => {
    const { cache, advance } = createCache({ ttlMs: 100 });
    cache.set("key", "value");

    advance(99);
    expect(cache.get("key")).toBe("value");

    advance(1);
    expect(cache.get("key")).toBeUndefined();
    expect(cache.stats().expirations).toBe(1);
  });

  it("does not store entries when the TTL is zero", () => {
    const { cache } = createCache({ ttlMs: 0 });
    cache.set("key", "value");

    expect(cache.get("key")).toBeUndefined();
    expect(cache.stats().entries).toBe(0);
  });

  it("evicts the oldest entry when maxEntries is reached", () => {
    const { cache } = createCache({ maxEntries: 2 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.stats().evictions).toBe(1);
  });

  it("invalidates by prefix without touching other tenants", () => {
    const { cache } = createCache();
    cache.set("orders:tenant_a:list:v1", ["a"]);
    cache.set("orders:tenant_a:item:1:v1", ["a1"]);
    cache.set("orders:tenant_b:list:v1", ["b"]);

    expect(cache.deleteByPrefix("orders:tenant_a:")).toBe(2);
    expect(cache.get("orders:tenant_a:list:v1")).toBeUndefined();
    expect(cache.get("orders:tenant_b:list:v1")).toEqual(["b"]);
  });

  it("stops serving entries after close", () => {
    const { cache } = createCache();
    cache.set("key", "value");
    cache.close();

    expect(cache.get("key")).toBeUndefined();
    expect(cache.stats()).toMatchObject({ entries: 0, closed: true });
  });
});
