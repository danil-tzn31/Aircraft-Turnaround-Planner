import type { ScenarioInput, ScheduleResult } from "./types";

const DAY = 1440;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type Status = "on-time" | "tight" | "late";

// All clock values are absolute minutes from the midnight before STA,
// so they can run past 1440. Use formatClock() to show them.
export type Summary = {
  onBlock: number;
  offBlock: number;
  std: number;
  departureDelay: number;
  buffer: number; // negative = late
  status: Status;
  stdOffset: number; // STD in minutes after on-block, can be negative
};

export function toMinutes(clock: string): number {
  const match = CLOCK.exec(clock);
  if (!match) throw new Error(`Invalid time "${clock}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// If STD is earlier than STA, the turn crosses midnight.
export function scheduledGround(sta: string, std: string): number {
  const diff = toMinutes(std) - toMinutes(sta);
  return diff < 0 ? diff + DAY : diff;
}

export function status(buffer: number): Status {
  if (buffer >= 5) return "on-time";
  if (buffer >= 0) return "tight";
  return "late";
}

export function summarise(input: ScenarioInput, result: ScheduleResult): Summary {
  const sta = toMinutes(input.sta);
  const ground = scheduledGround(input.sta, input.std);
  const onBlock = sta + input.arrivalDelay;
  const offBlock = onBlock + result.turnMinutes;
  const std = sta + ground;
  const buffer = ground - input.arrivalDelay - result.turnMinutes;

  return {
    onBlock,
    offBlock,
    std,
    departureDelay: Math.max(0, offBlock - std),
    buffer,
    status: status(buffer),
    stdOffset: ground - input.arrivalDelay,
  };
}
