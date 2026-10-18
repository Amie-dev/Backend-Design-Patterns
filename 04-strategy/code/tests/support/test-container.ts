import type { AppConfig } from "../../src/config/env";
import {
  createContainer,
  type Container,
  type ContainerOverrides,
} from "../../src/composition-root";
import { fixedClock } from "../../src/lib/clock";
import { createNoopLogger } from "../../src/lib/logger";
import { testConfig } from "./config";

export const TEST_NOW = "2026-02-01T10:00:00Z";

/**
 * Build a fresh graph per test with fake ports, a frozen clock, and a silent
 * logger. No module state is shared between tests.
 */
export function createTestContainer(
  overrides: ContainerOverrides = {},
  configOverrides: Partial<AppConfig> = {},
): Container {
  return createContainer(testConfig(configOverrides), {
    logger: createNoopLogger(),
    clock: fixedClock(TEST_NOW),
    ...overrides,
  });
}
