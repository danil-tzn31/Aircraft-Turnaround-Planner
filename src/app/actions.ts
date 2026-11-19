"use server";

import { nanoid } from "nanoid";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  hashScenario,
  normalise,
  scenarioInputSchema,
  titleSchema,
} from "@/lib/scenario";

const INVALID = "Something in this scenario isn't valid.";
const FAILED = "Couldn't save right now. Please try again.";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function saveScenario(
  rawInput: unknown,
  rawTitle: unknown,
): Promise<{ slug: string } | { error: string }> {
  const parsedInput = scenarioInputSchema.safeParse(rawInput);
  const parsedTitle = titleSchema.safeParse(rawTitle);
  if (!parsedInput.success || !parsedTitle.success) return { error: INVALID };
  const title = parsedTitle.data;

  try {
    const aircraft = await db.aircraftType.findUnique({
      where: { id: parsedInput.data.aircraftType },
      select: {
        twoDoorAvailable: true,
        templateVersion: true,
        tasks: { select: { key: true } },
      },
    });
    if (!aircraft) return { error: INVALID };

    const taskKeys = new Set(aircraft.tasks.map((t) => t.key));
    if (Object.keys(parsedInput.data.adjustments).some((key) => !taskKeys.has(key))) {
      return { error: INVALID };
    }

    const input = normalise(parsedInput.data, aircraft.twoDoorAvailable);
    const inputHash = hashScenario(input, title, aircraft.templateVersion);

    const findByHash = () =>
      db.scenario.findUnique({ where: { inputHash }, select: { id: true } });

    const existing = await findByHash();
    if (existing) return { slug: existing.id };

    // Two tries: the second only matters if the random id collided.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const created = await db.scenario.create({
          data: {
            id: nanoid(8),
            aircraftTypeId: input.aircraftType,
            title,
            input: input as unknown as Prisma.InputJsonObject,
            inputHash,
            templateVersion: aircraft.templateVersion,
          },
          select: { id: true },
        });
        return { slug: created.id };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Same scenario saved at the same moment: use that one.
        const raced = await findByHash();
        if (raced) return { slug: raced.id };
      }
    }
    return { error: FAILED };
  } catch {
    return { error: FAILED };
  }
}
