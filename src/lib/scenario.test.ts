import { describe, expect, it } from "vitest";
import {
  hashScenario,
  isSlug,
  normalise,
  scenarioInputSchema,
  titleSchema,
} from "./scenario";
import type { ScenarioInput } from "./types";

function valid(): ScenarioInput {
  return {
    aircraftType: "A320",
    sta: "14:05",
    std: "14:45",
    arrivalDelay: 10,
    toggles: { twoDoor: true, fwpob: false },
    adjustments: { catering: { startDelay: 5, extraDuration: 0 } },
  };
}

describe("scenarioInputSchema", () => {
  it("accepts valid input", () => {
    expect(scenarioInputSchema.safeParse(valid()).success).toBe(true);
  });

  it("rejects a bad time", () => {
    expect(scenarioInputSchema.safeParse({ ...valid(), sta: "24:00" }).success).toBe(false);
    expect(scenarioInputSchema.safeParse({ ...valid(), std: "9:30" }).success).toBe(false);
    expect(scenarioInputSchema.safeParse({ ...valid(), std: "14:60" }).success).toBe(false);
  });

  it("rejects minutes out of range", () => {
    expect(scenarioInputSchema.safeParse({ ...valid(), arrivalDelay: 181 }).success).toBe(false);
    expect(scenarioInputSchema.safeParse({ ...valid(), arrivalDelay: -1 }).success).toBe(false);
    expect(scenarioInputSchema.safeParse({ ...valid(), arrivalDelay: 1.5 }).success).toBe(false);

    const tooLong = { fuel: { startDelay: 0, extraDuration: 121 } };
    expect(scenarioInputSchema.safeParse({ ...valid(), adjustments: tooLong }).success).toBe(false);
    const tooLate = { fuel: { startDelay: 121, extraDuration: 0 } };
    expect(scenarioInputSchema.safeParse({ ...valid(), adjustments: tooLate }).success).toBe(false);
  });

  it("rejects an unknown aircraft", () => {
    expect(scenarioInputSchema.safeParse({ ...valid(), aircraftType: "B738" }).success).toBe(false);
  });
});

describe("titleSchema", () => {
  it("trims, and turns empty or missing into null", () => {
    expect(titleSchema.parse("  Rainy day  ")).toBe("Rainy day");
    expect(titleSchema.parse("   ")).toBeNull();
    expect(titleSchema.parse(undefined)).toBeNull();
    expect(titleSchema.parse(null)).toBeNull();
  });

  it("rejects more than 60 characters", () => {
    expect(titleSchema.safeParse("x".repeat(60)).success).toBe(true);
    expect(titleSchema.safeParse("x".repeat(61)).success).toBe(false);
  });
});

describe("normalise", () => {
  it("drops adjustments that are both zero", () => {
    const input = valid();
    input.adjustments.fuel = { startDelay: 0, extraDuration: 0 };
    expect(Object.keys(normalise(input, true).adjustments)).toEqual(["catering"]);
  });

  it("sorts adjustment keys", () => {
    const input = valid();
    input.adjustments = {
      fuel: { startDelay: 5, extraDuration: 0 },
      board: { startDelay: 0, extraDuration: 5 },
      catering: { startDelay: 5, extraDuration: 5 },
    };
    expect(Object.keys(normalise(input, true).adjustments)).toEqual(["board", "catering", "fuel"]);
  });

  it("forces two doors off when the type can't use them", () => {
    expect(normalise(valid(), false).toggles.twoDoor).toBe(false);
    expect(normalise(valid(), true).toggles.twoDoor).toBe(true);
  });
});

describe("hashScenario", () => {
  it("ignores the order of adjustment keys", () => {
    const a = valid();
    a.adjustments = {
      fuel: { startDelay: 5, extraDuration: 0 },
      board: { startDelay: 0, extraDuration: 5 },
    };
    const b = valid();
    b.adjustments = {
      board: { startDelay: 0, extraDuration: 5 },
      fuel: { startDelay: 5, extraDuration: 0 },
    };
    expect(hashScenario(normalise(a, true), null, 1)).toBe(
      hashScenario(normalise(b, true), null, 1),
    );
  });

  it("ignores zero adjustments", () => {
    const withZero = valid();
    withZero.adjustments.board = { startDelay: 0, extraDuration: 0 };
    expect(hashScenario(normalise(withZero, true), null, 1)).toBe(
      hashScenario(normalise(valid(), true), null, 1),
    );
  });

  it("changes when the scenario, title or template version changes", () => {
    const base = hashScenario(normalise(valid(), true), null, 1);
    expect(hashScenario(normalise({ ...valid(), arrivalDelay: 15 }, true), null, 1)).not.toBe(base);
    expect(hashScenario(normalise(valid(), true), "Rainy day", 1)).not.toBe(base);
    expect(hashScenario(normalise(valid(), true), null, 2)).not.toBe(base);
  });

  it("returns a sha256 hex string", () => {
    expect(hashScenario(normalise(valid(), true), null, 1)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isSlug", () => {
  it("accepts 8 url-safe characters only", () => {
    expect(isSlug("aB3_-x9Z")).toBe(true);
    expect(isSlug("short")).toBe(false);
    expect(isSlug("has space")).toBe(false);
    expect(isSlug("toolongslug")).toBe(false);
  });
});
