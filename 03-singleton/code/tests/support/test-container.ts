import type { Config } from "../../src/config/env";
import {
  createContainer,
  type Container,
  type ContainerDependencies,
} from "../../src/composition-root";
import { createNoopLogger } from "../../src/lib/logger";
import { testConfig } from "./config";

/**
 * Build a fresh graph per test. No module state is reset and no sockets are
 * opened, so tests never depend on execution order.
 */
export function createTestContainer(
  configOverrides: Partial<Config> = {},
  deps: ContainerDependencies = {},
): Container {
  const logger = deps.logger ?? createNoopLogger();

  return createContainer(testConfig(configOverrides), { ...deps, logger });
}
