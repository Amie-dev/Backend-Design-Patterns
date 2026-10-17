import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  tenantId: string;
  userId: string;
  startedAt: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function inside a request-scoped store. `run` is the only safe
 * primitive here; `enterWith` can leak context into later requests.
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Strict accessor for code that must run inside a request. Throwing loudly
 * beats silently falling back to a default tenant.
 */
export function currentRequestContext(): RequestContext {
  const context = storage.getStore();

  if (!context) {
    throw new Error(
      "No request context. Is the requestContext middleware installed?",
    );
  }

  return context;
}
