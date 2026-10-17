export type RuntimeState = {
  readonly instanceId: string;
  readonly startedAt: Date;
  requestsServed: number;
  shuttingDown: boolean;
};

/**
 * Per-process state used only for visibility. It is deliberately separate
 * from request data: every request mutates this safely, but no request
 * reads another request's values from it.
 */
export function createRuntimeState(
  instanceId: string,
  clock: () => Date = () => new Date(),
): RuntimeState {
  return {
    instanceId,
    startedAt: clock(),
    requestsServed: 0,
    shuttingDown: false,
  };
}
