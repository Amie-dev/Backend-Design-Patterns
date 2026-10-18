import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env";

describe("loadConfig", () => {
  it("applies demo defaults", () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.enabledDiscounts).toEqual(["premium", "student"]);
    expect(config.festival.enabled).toBe(true);
    expect(config.festival.fixedAmount).toBe(10_000);
    expect(config.festival.excludedProductIds).toEqual(["prod_sale"]);
    expect(config.festival.rolloutPercent).toBe(100);
    expect(config.festival.startsAt.getTime()).toBeLessThan(
      config.festival.endsAt.getTime(),
    );
  });

  it("trims and de-duplicates enabled strategies", () => {
    const config = loadConfig({
      DISCOUNTS_ENABLED: " premium , student,premium ",
    });

    expect(config.enabledDiscounts).toEqual(["premium", "student"]);
  });

  it("rejects unknown strategy names at boot", () => {
    expect(() =>
      loadConfig({ DISCOUNTS_ENABLED: "premium,vip" }),
    ).toThrow(/Unknown discount strategies: vip/);
  });

  it("rejects a rollout outside 0..100", () => {
    expect(() => loadConfig({ FESTIVAL_ROLLOUT_PERCENT: "101" })).toThrow();
  });

  it("rejects an inverted campaign window", () => {
    expect(() =>
      loadConfig({
        FESTIVAL_STARTS_AT: "2026-02-10T00:00:00Z",
        FESTIVAL_ENDS_AT: "2026-02-01T00:00:00Z",
      }),
    ).toThrow(/FESTIVAL_ENDS_AT must be after/);
  });

  it("parses an explicit campaign window", () => {
    const config = loadConfig({
      FESTIVAL_STARTS_AT: "2026-01-25T00:00:00Z",
      FESTIVAL_ENDS_AT: "2026-02-10T00:00:00Z",
    });

    expect(config.festival.startsAt.toISOString()).toBe(
      "2026-01-25T00:00:00.000Z",
    );
    expect(config.festival.endsAt.toISOString()).toBe(
      "2026-02-10T00:00:00.000Z",
    );
  });

  it("can disable the festival", () => {
    const config = loadConfig({ FESTIVAL_ENABLED: "false" });

    expect(config.festival.enabled).toBe(false);
  });
});
