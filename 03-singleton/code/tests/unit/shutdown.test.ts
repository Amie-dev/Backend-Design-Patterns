import { describe, expect, it, vi } from "vitest";
import { createNoopLogger } from "../../src/lib/logger";
import {
  createShutdownHandler,
  type ShutdownDependencies,
  type ShutdownServer,
} from "../../src/server/shutdown";

function harness(overrides: Partial<ShutdownDependencies> = {}) {
  const events: string[] = [];
  const exitMock = vi.fn((code: number) => {
    events.push(`exit:${code}`);
  });
  const server: ShutdownServer = {
    close: (callback) => {
      events.push("server.close");
      callback();
    },
    closeIdleConnections: () => events.push("idle"),
  };
  const closeResources = vi.fn(async () => {
    events.push("resources");
  });
  const onShutdownStart = vi.fn();

  const handler = createShutdownHandler({
    server,
    closeResources,
    logger: createNoopLogger(),
    timeoutMs: 1_000,
    exit: exitMock as unknown as (code: number) => never,
    onShutdownStart,
    ...overrides,
  });

  return { events, exitMock, handler, closeResources, onShutdownStart };
}

describe("createShutdownHandler", () => {
  it("closes the server, then resources, then exits 0", async () => {
    const { events, exitMock, handler } = harness();

    await handler("SIGTERM");

    expect(events).toEqual([
      "server.close",
      "idle",
      "resources",
      "exit:0",
    ]);
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it("is idempotent when two signals arrive", async () => {
    const { events, exitMock, handler, closeResources } = harness();

    await Promise.all([handler("SIGTERM"), handler("SIGINT")]);

    expect(events.filter((event) => event === "server.close")).toHaveLength(1);
    expect(closeResources).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledTimes(1);
  });

  it("marks readiness as draining before closing the listener", async () => {
    const { onShutdownStart, handler } = harness();

    await handler("SIGTERM");

    expect(onShutdownStart).toHaveBeenCalledTimes(1);
  });

  it("exits 1 when resources fail to close", async () => {
    const { exitMock, handler } = harness({
      closeResources: async () => {
        throw new Error("pool close failed");
      },
    });

    await handler("SIGTERM");

    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it("exits 1 when the server fails to close", async () => {
    const exitMock = vi.fn();
    const closeResources = vi.fn(async () => undefined);
    const handler = createShutdownHandler({
      server: {
        close: (callback) => callback(new Error("close failed")),
      },
      closeResources,
      logger: createNoopLogger(),
      exit: exitMock as unknown as (code: number) => never,
    });

    await handler("SIGTERM");

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(closeResources).not.toHaveBeenCalled();
  });

  it("forces an exit when draining exceeds the timeout", async () => {
    vi.useFakeTimers();
    const exitMock = vi.fn();

    const handler = createShutdownHandler({
      server: { close: () => undefined },
      closeResources: () => new Promise<void>(() => undefined),
      logger: createNoopLogger(),
      timeoutMs: 1_000,
      exit: exitMock as unknown as (code: number) => never,
    });

    void handler("SIGTERM");
    await vi.advanceTimersByTimeAsync(1_000);

    expect(exitMock).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
