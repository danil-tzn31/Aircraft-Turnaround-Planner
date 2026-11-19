import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { isSlug, scenarioInputSchema } from "./scenario";
import type { AircraftTypeId, ScenarioInput, TemplateTask } from "./types";

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

export type SavedScenario = {
  id: string;
  title: string | null;
  input: ScenarioInput;
  templateVersion: number;
  aircraftTypeId: AircraftTypeId;
};

// Saved scenarios never change, so they can be cached for good.
export async function getScenario(slug: string): Promise<SavedScenario | null> {
  "use cache";
  cacheLife("max");

  if (!isSlug(slug)) return null;

  const row = await db.scenario.findUnique({ where: { id: slug } });
  if (!row) return null;

  // The row was validated on the way in; check again in case it was edited by hand.
  const input = scenarioInputSchema.safeParse(row.input);
  if (!input.success || !isAircraftTypeId(row.aircraftTypeId)) return null;

  return {
    id: row.id,
    title: row.title,
    input: input.data,
    templateVersion: row.templateVersion,
    aircraftTypeId: row.aircraftTypeId,
  };
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
