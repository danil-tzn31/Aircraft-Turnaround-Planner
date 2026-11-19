import { describe, expect, it } from "vitest";
import { formatClock, scheduledGround, status, summarise, toMinutes } from "./clock";
import type { ScenarioInput, ScheduleResult } from "./types";

function input(sta: string, std: string, arrivalDelay = 0): ScenarioInput {
  return {
    aircraftType: "A320",
    sta,
    std,
    arrivalDelay,
    toggles: { twoDoor: false, fwpob: false },
    adjustments: {},
  };
}

function result(turnMinutes: number): ScheduleResult {
  return { tasks: [], turnMinutes, criticalPath: [] };
}

describe("toMinutes", () => {
  it("reads 24-hour times", () => {
    expect(toMinutes("14:05")).toBe(845);
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("rejects anything else", () => {
    expect(() => toMinutes("24:00")).toThrow();
    expect(() => toMinutes("9:30")).toThrow();
  });
});

describe("formatClock", () => {
  it("wraps past midnight", () => {
    expect(formatClock(1470)).toBe("00:30");
    expect(formatClock(845)).toBe("14:05");
  });

  it("wraps backwards too", () => {
    expect(formatClock(-10)).toBe("23:50");
  });
});

describe("scheduledGround", () => {
  it("handles a normal turn", () => {
    expect(scheduledGround("14:05", "14:45")).toBe(40);
  });

  it("crosses midnight", () => {
    expect(scheduledGround("23:40", "00:20")).toBe(40);
  });
});

describe("status", () => {
  it("uses the 5-minute and 0-minute thresholds", () => {
    expect(status(5)).toBe("on-time");
    expect(status(4)).toBe("tight");
    expect(status(0)).toBe("tight");
    expect(status(-1)).toBe("late");
  });
});

describe("summarise", () => {
  it("works out an on-time turn", () => {
    const s = summarise(input("14:05", "14:45"), result(36));

    expect(formatClock(s.onBlock)).toBe("14:05");
    expect(formatClock(s.offBlock)).toBe("14:41");
    expect(s.buffer).toBe(4);
    expect(s.status).toBe("tight");
    expect(s.departureDelay).toBe(0);
    expect(s.stdOffset).toBe(40);
  });

  it("works across midnight", () => {
    const s = summarise(input("23:40", "00:20", 10), result(35));

    expect(formatClock(s.offBlock)).toBe("00:25");
    expect(formatClock(s.std)).toBe("00:20");
    expect(s.departureDelay).toBe(5);
    expect(s.buffer).toBe(-5);
    expect(s.status).toBe("late");
  });

  it("never gives a negative departure delay", () => {
    const s = summarise(input("14:05", "14:45"), result(20));

    expect(s.departureDelay).toBe(0);
    expect(s.buffer).toBe(20);
    expect(s.status).toBe("on-time");
  });

  it("puts STD before on-block when the inbound is very late", () => {
    const s = summarise(input("14:05", "14:45", 60), result(35));

    expect(s.stdOffset).toBe(-20);
    expect(s.departureDelay).toBe(55);
  });
});
