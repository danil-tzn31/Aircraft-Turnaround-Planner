import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import type { AircraftTypeId, TemplateTask } from "./types";

export const AIRCRAFT_TYPE_IDS = ["A320", "A21N", "A339", "AT76"] as const satisfies readonly AircraftTypeId[];

export function isAircraftTypeId(value: string): value is AircraftTypeId {
  return (AIRCRAFT_TYPE_IDS as readonly string[]).includes(value);
}

export type Aircraft = {
  id: AircraftTypeId;
  name: string;
  seats: number;
  twoDoorAvailable: boolean;
  defaultTwoDoor: boolean;
  defaultGroundMinutes: number;
  templateVersion: number;
};

export type Template = { aircraft: Aircraft; tasks: TemplateTask[] };

const aircraftSelect = {
  id: true,
  name: true,
  seats: true,
  twoDoorAvailable: true,
  defaultTwoDoor: true,
  defaultGroundMinutes: true,
  templateVersion: true,
} as const;

// Fleet order from the plan, not alphabetical.
function fleetOrder(id: string) {
  return (AIRCRAFT_TYPE_IDS as readonly string[]).indexOf(id);
}

export async function getAircraftTypes(): Promise<Aircraft[]> {
  "use cache";
  cacheLife("max");
  cacheTag("templates");

  const rows = await db.aircraftType.findMany({ select: aircraftSelect });
  return rows
    .filter((row) => isAircraftTypeId(row.id))
    .map((row) => ({ ...row, id: row.id as AircraftTypeId }))
    .sort((a, b) => fleetOrder(a.id) - fleetOrder(b.id));
}

export async function getTemplate(typeId: string): Promise<Template | null> {
  "use cache";
  cacheLife("max");
  cacheTag("templates");

  if (!isAircraftTypeId(typeId)) return null;

  const row = await db.aircraftType.findUnique({
    where: { id: typeId },
    select: { ...aircraftSelect, tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!row) return null;

  const { tasks, ...aircraft } = row;
  return {
    aircraft: { ...aircraft, id: typeId },
    tasks: tasks.map((t) => ({
      key: t.key,
      label: t.label,
      category: t.category,
      durationOneDoor: t.durationOneDoor,
      durationTwoDoor: t.durationTwoDoor,
      startOffset: t.startOffset,
      dependsOn: t.dependsOn,
      dependsOnWithoutFwpob: t.dependsOnWithoutFwpob,
      sortOrder: t.sortOrder,
    })),
  };
}
