import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { PoolClosedError, PoolTimeoutError } from "../../src/errors/app.errors";
import { DatabasePool } from "../../src/infrastructure/database";

describe("DatabasePool", () => {
  it("never hands out more connections than its size", async () => {
    const pool = new DatabasePool({ size: 2, id: "db_test" });

    await Promise.all(
      Array.from({ length: 8 }, () =>
        pool.query(async () => {
          await sleep(10);
        }),
      ),
    );

    expect(pool.stats()).toMatchObject({
      id: "db_test",
      size: 2,
      inUse: 0,
      available: 2,
      waiting: 0,
      acquiredTotal: 8,
      releasedTotal: 8,
      maxObservedInUse: 2,
    });

    await pool.close();
  });

  it("queues callers when saturated and serves them in order", async () => {
    const pool = new DatabasePool({ size: 1 });
    const events: string[] = [];

    await Promise.all([
      pool.query(async () => {
        events.push("first-start");
        await sleep(20);
        events.push("first-end");
      }),
      pool.query(async () => {
        events.push("second-start");
      }),
    ]);

    expect(events).toEqual(["first-start", "first-end", "second-start"]);
    expect(pool.stats().maxObservedInUse).toBe(1);

    await pool.close();
  });

  it("times out a queued caller instead of queueing forever", async () => {
    const pool = new DatabasePool({
      size: 1,
      acquireTimeoutMs: 20,
      id: "db_timeout",
    });

    const first = pool.query(async () => {
      await sleep(60);
    });

    await expect(pool.query(async () => undefined)).rejects.toBeInstanceOf(
      PoolTimeoutError,
    );

    await first;
    expect(pool.stats()).toMatchObject({ timedOutTotal: 1, inUse: 0 });

    await pool.close();
  });

  it("releases the lease when the work throws", async () => {
    const pool = new DatabasePool({ size: 1 });

    await expect(
      pool.query(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(pool.stats()).toMatchObject({
      inUse: 0,
      releasedTotal: 1,
      available: 1,
    });

    await pool.close();
  });

  it("ignores a double release", async () => {
    const pool = new DatabasePool({ size: 1 });
    const lease = await pool.acquire();

    pool.release(lease);
    pool.release(lease);

    expect(pool.stats()).toMatchObject({
      inUse: 0,
      releasedTotal: 1,
    });

    await pool.close();
  });

  it("rejects queued callers when the pool closes", async () => {
    const pool = new DatabasePool({ size: 1, acquireTimeoutMs: 5_000 });
    const lease = await pool.acquire();
    const queued = pool.acquire();
    const assertion = expect(queued).rejects.toBeInstanceOf(PoolClosedError);

    const closing = pool.close();
    await assertion;
    pool.release(lease);
    await closing;

    expect(pool.stats()).toMatchObject({ closed: true, waiting: 0 });
  });

  it("waits for in-flight leases before resolving close", async () => {
    const pool = new DatabasePool({ size: 1 });
    const lease = await pool.acquire();
    let closed = false;

    const closing = pool.close().then(() => {
      closed = true;
    });

    await sleep(10);
    expect(closed).toBe(false);

    pool.release(lease);
    await closing;
    expect(closed).toBe(true);
  });

  it("rejects new acquisitions after close", async () => {
    const pool = new DatabasePool({ size: 1 });
    await pool.close();

    await expect(pool.acquire()).rejects.toBeInstanceOf(PoolClosedError);
    expect(pool.stats().rejectedTotal).toBe(1);
  });

  it("answers ping with a non-negative latency", async () => {
    const pool = new DatabasePool({ size: 1 });

    expect(await pool.ping()).toBeGreaterThanOrEqual(0);
    await pool.close();
  });
});
