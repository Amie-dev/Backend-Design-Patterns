import { describe, expect, it } from "vitest";
import { isInRollout } from "../../src/lib/rollout";

describe("isInRollout", () => {
  it("is always off at 0% and always on at 100%", () => {
    expect(isInRollout("usr_1", "festival:demo", 0)).toBe(false);
    expect(isInRollout("usr_1", "festival:demo", 100)).toBe(true);
  });

  it("returns the same answer for the same user and experiment", () => {
    const results = Array.from({ length: 20 }, () =>
      isInRollout("usr_1", "festival:demo", 50),
    );

    expect(new Set(results).size).toBe(1);
  });

  it("splits a population at 50%", () => {
    const users = Array.from({ length: 200 }, (_, index) => `usr_${index}`);
    const included = users.filter((user) =>
      isInRollout(user, "festival:demo", 50),
    );

    expect(included.length).toBeGreaterThan(50);
    expect(included.length).toBeLessThan(150);
  });
});
