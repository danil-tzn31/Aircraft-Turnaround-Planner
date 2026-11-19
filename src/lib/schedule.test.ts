import { describe, expect, it } from "vitest";
import { schedule } from "./schedule";
import type { Adjustment, TemplateTask, Toggles } from "./types";

let nextSort = 1;

function task(
  key: string,
  duration: number,
  extra: Partial<TemplateTask> = {},
): TemplateTask {
  return {
    key,
    label: key.toUpperCase(),
    category: "technical",
    durationOneDoor: duration,
    durationTwoDoor: duration,
    startOffset: 0,
    dependsOn: [],
    dependsOnWithoutFwpob: [],
    sortOrder: nextSort++,
    ...extra,
  };
}

const OFF: Toggles = { twoDoor: false, fwpob: false };
const FWPOB_ON: Toggles = { twoDoor: false, fwpob: true };

function delay(startDelay: number, extraDuration = 0): Adjustment {
  return { startDelay, extraDuration };
}

function byKey(result: ReturnType<typeof schedule>, key: string) {
  const found = result.tasks.find((t) => t.key === key);
  if (!found) throw new Error(`no task ${key}`);
  return found;
}

// A(10) and B(4) run side by side, then E(2) waits for both.
const parallel = () => [
  task("a", 10),
  task("b", 4),
  task("e", 2, { dependsOn: ["a", "b"] }),
];

describe("schedule", () => {
  it("adds up a simple chain", () => {
    const result = schedule(
      [
        task("a", 5),
        task("b", 7, { dependsOn: ["a"] }),
        task("c", 3, { dependsOn: ["b"] }),
      ],
      OFF,
      {},
    );

    expect(result.turnMinutes).toBe(15);
    expect(result.criticalPath).toEqual(["a", "b", "c"]);
    expect(byKey(result, "c").earlyStart).toBe(12);
  });

  it("marks the longer branch critical and gives the shorter one float", () => {
    const result = schedule(parallel(), OFF, {});

    expect(result.turnMinutes).toBe(12);
    expect(result.criticalPath).toEqual(["a", "e"]);
    expect(byKey(result, "b").float).toBe(6);
    expect(byKey(result, "b").critical).toBe(false);
  });

  it("still pushes a task that is waiting on another", () => {
    const result = schedule(
      [task("a", 12), task("b", 5, { dependsOn: ["a"] })],
      OFF,
      { b: delay(10) },
    );

    expect(byKey(result, "b").earlyStart).toBe(22);
    expect(byKey(result, "b").startDelay).toBe(10);
    expect(result.turnMinutes).toBe(27);
  });

  it("absorbs a delay that fits inside the float", () => {
    const result = schedule(parallel(), OFF, { b: delay(5) });

    expect(result.turnMinutes).toBe(12);
    expect(result.criticalPath).toEqual(["a", "e"]);
    expect(byKey(result, "b").float).toBe(1);
  });

  it("moves the turn and the critical path when a delay goes past the float", () => {
    const result = schedule(parallel(), OFF, { b: delay(8) });

    expect(result.turnMinutes).toBe(14);
    expect(result.criticalPath).toEqual(["b", "e"]);
    expect(byKey(result, "a").float).toBe(2);
  });

  it("lengthens a task that runs long", () => {
    const result = schedule(
      [task("a", 5), task("b", 7, { dependsOn: ["a"] })],
      OFF,
      { a: delay(0, 4) },
    );

    expect(byKey(result, "a").duration).toBe(9);
    expect(result.turnMinutes).toBe(16);
  });

  it("uses two-door durations when two-door boarding is on", () => {
    const tasks = [task("board", 20, { durationTwoDoor: 12 })];

    expect(schedule(tasks, OFF, {}).turnMinutes).toBe(20);
    expect(schedule(tasks, { twoDoor: true, fwpob: false }, {}).turnMinutes).toBe(12);
  });

  it("respects a task's start offset", () => {
    const result = schedule([task("a", 5, { startOffset: 3 })], OFF, {});

    expect(byKey(result, "a").earlyStart).toBe(3);
    expect(result.turnMinutes).toBe(8);
  });

  describe("refuelling with passengers on board", () => {
    const ramp = () => [
      task("deboard", 8),
      task("fuel", 15, { dependsOnWithoutFwpob: ["deboard"] }),
      task("clean", 10, { dependsOn: ["deboard"] }),
      task("board", 12, { dependsOn: ["clean"], dependsOnWithoutFwpob: ["fuel"] }),
    ];

    it("makes fuelling wait for deboarding and boarding wait for fuel when off", () => {
      const result = schedule(ramp(), OFF, {});

      expect(byKey(result, "fuel").earlyStart).toBe(8);
      expect(byKey(result, "board").earlyStart).toBe(23);
      expect(result.turnMinutes).toBe(35);
      expect(result.criticalPath).toEqual(["deboard", "fuel", "board"]);
    });

    it("lets fuelling run alongside when on", () => {
      const result = schedule(ramp(), FWPOB_ON, {});

      expect(byKey(result, "fuel").earlyStart).toBe(0);
      expect(result.turnMinutes).toBe(30);
      expect(result.criticalPath).toEqual(["deboard", "clean", "board"]);
      expect(byKey(result, "fuel").critical).toBe(false);
    });
  });

  it("marks both branches critical when they tie", () => {
    const result = schedule(
      [task("a", 10), task("b", 10), task("e", 2, { dependsOn: ["a", "b"] })],
      OFF,
      {},
    );

    expect(result.criticalPath).toEqual(["a", "b", "e"]);
  });

  it("counts a successor's start delay against its predecessor's float", () => {
    // A(10) -> C(5) beside B(20). C starts 3 min late, so A can only slip 2.
    const result = schedule(
      [task("a", 10), task("c", 5, { dependsOn: ["a"] }), task("b", 20)],
      OFF,
      { c: delay(3) },
    );

    expect(result.turnMinutes).toBe(20);
    expect(byKey(result, "a").float).toBe(2);
    expect(byKey(result, "c").float).toBe(2);

    const slipped = schedule(
      [task("a", 10), task("c", 5, { dependsOn: ["a"] }), task("b", 20)],
      OFF,
      { a: delay(2), c: delay(3) },
    );
    expect(slipped.turnMinutes).toBe(20);
    expect(slipped.criticalPath).toEqual(["a", "b", "c"]);
  });

  it("ignores adjustments for tasks that don't exist", () => {
    const tasks = parallel();
    const plain = schedule(tasks, OFF, {});
    const withGhost = schedule(tasks, OFF, { removed_task: delay(30, 30) });

    expect(withGhost).toEqual(plain);
  });

  it("returns tasks in sort order", () => {
    const result = schedule(
      [
        task("late", 5, { sortOrder: 3, dependsOn: ["early"] }),
        task("early", 5, { sortOrder: 1 }),
        task("middle", 2, { sortOrder: 2 }),
      ],
      OFF,
      {},
    );

    expect(result.tasks.map((t) => t.key)).toEqual(["early", "middle", "late"]);
  });

  it("throws on a cycle", () => {
    expect(() =>
      schedule(
        [
          task("a", 1, { dependsOn: ["b"] }),
          task("b", 1, { dependsOn: ["a"] }),
          task("c", 1),
        ],
        OFF,
        {},
      ),
    ).toThrow("Cycle detected among: a, b");
  });

  it("throws on an unknown dependency", () => {
    expect(() =>
      schedule([task("y", 1, { dependsOn: ["x"] })], OFF, {}),
    ).toThrow('Unknown dependency "x" on task "y"');
  });

  it("checks FWPOB-only dependencies too", () => {
    const tasks = [task("fuel", 5, { dependsOnWithoutFwpob: ["nope"] })];

    expect(() => schedule(tasks, OFF, {})).toThrow('Unknown dependency "nope"');
    expect(() => schedule(tasks, FWPOB_ON, {})).not.toThrow();
  });
});
