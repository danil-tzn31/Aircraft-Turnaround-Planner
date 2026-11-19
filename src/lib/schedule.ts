import type {
  Adjustment,
  ScheduleResult,
  ScheduledTask,
  TemplateTask,
  Toggles,
} from "./types";

type ResolvedTask = {
  task: TemplateTask;
  duration: number;
  startDelay: number;
  deps: string[];
};

const NO_ADJUSTMENT: Adjustment = { startDelay: 0, extraDuration: 0 };

export function schedule(
  tasks: TemplateTask[],
  toggles: Toggles,
  adjustments: Record<string, Adjustment>,
): ScheduleResult {
  const resolved = resolveTasks(tasks, toggles, adjustments);
  const order = topologicalOrder(resolved);

  const successors = new Map<string, string[]>();
  for (const key of order) successors.set(key, []);
  for (const key of order) {
    for (const dep of resolved.get(key)!.deps) successors.get(dep)!.push(key);
  }

  // Forward pass: earliest each task can start and finish.
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();
  for (const key of order) {
    const { task, duration, startDelay, deps } = resolved.get(key)!;
    let ready = Math.max(task.startOffset, 0);
    for (const dep of deps) ready = Math.max(ready, earlyFinish.get(dep)!);
    // The delay counts from when the task could otherwise start, so a late
    // team still shows up even when the task is waiting on others.
    const start = ready + startDelay;
    earlyStart.set(key, start);
    earlyFinish.set(key, start + duration);
  }

  let turnMinutes = 0;
  for (const finish of earlyFinish.values()) turnMinutes = Math.max(turnMinutes, finish);

  // Backward pass: latest each task can start and finish without moving the turn.
  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();
  for (const key of [...order].reverse()) {
    const { duration } = resolved.get(key)!;
    let finish = turnMinutes;
    for (const next of successors.get(key)!) {
      // A successor still waits out its own start delay after we finish,
      // so we have to be done that much earlier.
      finish = Math.min(finish, lateStart.get(next)! - resolved.get(next)!.startDelay);
    }
    lateFinish.set(key, finish);
    lateStart.set(key, finish - duration);
  }

  const scheduled = new Map<string, ScheduledTask>();
  for (const key of order) {
    const { task, duration, startDelay } = resolved.get(key)!;
    const float = lateStart.get(key)! - earlyStart.get(key)!;
    scheduled.set(key, {
      ...task,
      duration,
      startDelay,
      earlyStart: earlyStart.get(key)!,
      earlyFinish: earlyFinish.get(key)!,
      lateStart: lateStart.get(key)!,
      lateFinish: lateFinish.get(key)!,
      float,
      critical: float === 0,
    });
  }

  return {
    // sort() is stable, so tasks with the same sortOrder keep template order
    tasks: [...scheduled.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    turnMinutes,
    criticalPath: order.filter((key) => scheduled.get(key)!.critical),
  };
}

function resolveTasks(
  tasks: TemplateTask[],
  toggles: Toggles,
  adjustments: Record<string, Adjustment>,
): Map<string, ResolvedTask> {
  const resolved = new Map<string, ResolvedTask>();

  for (const task of tasks) {
    if (resolved.has(task.key)) {
      throw new Error(`Duplicate task key "${task.key}"`);
    }
    // Adjustments for keys that aren't in the template are simply never read.
    const adjustment = Object.hasOwn(adjustments, task.key)
      ? adjustments[task.key]
      : NO_ADJUSTMENT;
    const baseDuration = toggles.twoDoor ? task.durationTwoDoor : task.durationOneDoor;
    const deps = toggles.fwpob
      ? task.dependsOn
      : [...task.dependsOn, ...task.dependsOnWithoutFwpob];

    resolved.set(task.key, {
      task,
      duration: baseDuration + adjustment.extraDuration,
      startDelay: adjustment.startDelay,
      deps: [...new Set(deps)],
    });
  }

  for (const { task, deps } of resolved.values()) {
    for (const dep of deps) {
      if (!resolved.has(dep)) {
        throw new Error(`Unknown dependency "${dep}" on task "${task.key}"`);
      }
    }
  }

  return resolved;
}

// Kahn's algorithm. Whatever is left with unmet deps at the end is in a cycle
// (or waiting on one).
function topologicalOrder(resolved: Map<string, ResolvedTask>): string[] {
  const waitingOn = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const [key, { deps }] of resolved) {
    waitingOn.set(key, deps.length);
    successors.set(key, []);
  }
  for (const [key, { deps }] of resolved) {
    for (const dep of deps) successors.get(dep)!.push(key);
  }

  const queue = [...resolved.keys()].filter((key) => waitingOn.get(key) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const key = queue.shift()!;
    order.push(key);
    for (const next of successors.get(key)!) {
      const remaining = waitingOn.get(next)! - 1;
      waitingOn.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length < resolved.size) {
    const stuck = [...resolved.keys()].filter((key) => !order.includes(key));
    throw new Error(`Cycle detected among: ${stuck.join(", ")}`);
  }

  return order;
}
