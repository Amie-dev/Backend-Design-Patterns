import type { Logger } from "../lib/logger";

export type ShutdownServer = {
  close(callback: (error?: Error) => void): void;
  closeIdleConnections?: () => void;
};

export type ShutdownDependencies = {
  server: ShutdownServer;
  closeResources: () => Promise<void>;
  logger: Pick<Logger, "info" | "error">;
  timeoutMs?: number;
  /** Injected so tests never kill the test runner. */
  exit?: (code: number) => never;
  /** Flip readiness to 503 before the listener stops. */
  onShutdownStart?: () => void;
};

/**
 * SIGTERM -> stop accepting -> drain in-flight -> close resources -> exit.
 * Idempotent: a second signal is ignored while the first drain is running.
 */
export function createShutdownHandler({
  server,
  closeResources,
  logger,
  timeoutMs = 10_000,
  exit = process.exit,
  onShutdownStart,
}: ShutdownDependencies) {
  let started = false;

  return async (signal: string): Promise<void> => {
    if (started) return;
    started = true;

    onShutdownStart?.();
    logger.info("shutting down", { signal, timeoutMs });

    const forceExit = setTimeout(() => {
      logger.error("forced shutdown after timeout");
      exit(1);
    }, timeoutMs);
    forceExit.unref?.();

    try {
      const closed = new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });

      server.closeIdleConnections?.();
      await closed;
      await closeResources();

      clearTimeout(forceExit);
      exit(0);
    } catch (error) {
      logger.error("shutdown failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      exit(1);
    }
  };
}
