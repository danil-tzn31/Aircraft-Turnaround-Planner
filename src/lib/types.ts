// Time is in minutes after on-block (aircraft parked, chocks in).

export type Category =
  | "passenger"
  | "baggage"
  | "fuel"
  | "catering"
  | "cleaning"
  | "technical"
  | "departure";

export type AircraftTypeId = "A320" | "A21N" | "A339" | "AT76";

export type TemplateTask = {
  key: string;
  label: string;
  category: Category;
  durationOneDoor: number;
  durationTwoDoor: number; // same as one-door when doors don't matter
  startOffset: number; // earliest start after on-block
  dependsOn: string[];
  dependsOnWithoutFwpob: string[]; // only apply when FWPOB is off
  sortOrder: number;
};

export type Adjustment = {
  startDelay: number; // team arrives late
  extraDuration: number; // task runs long
};

export type Toggles = { twoDoor: boolean; fwpob: boolean };

export type ScenarioInput = {
  aircraftType: AircraftTypeId;
  sta: string; // "14:05", local, 24h
  std: string;
  arrivalDelay: number;
  toggles: Toggles;
  adjustments: Record<string, Adjustment>; // missing key = no adjustment
};

export type ScheduledTask = TemplateTask & {
  duration: number;
  startDelay: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  float: number;
  critical: boolean;
};

export type ScheduleResult = {
  tasks: ScheduledTask[]; // in sortOrder
  turnMinutes: number;
  criticalPath: string[];
};
