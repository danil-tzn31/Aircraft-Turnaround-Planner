import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScenarioInput } from "./types";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const adjustmentSchema = z.object({
  startDelay: z.number().int().min(0).max(120),
  extraDuration: z.number().int().min(0).max(120),
});

export const scenarioInputSchema = z.object({
  aircraftType: z.enum(["A320", "A21N", "A339", "AT76"]),
  sta: clock,
  std: clock,
  arrivalDelay: z.number().int().min(0).max(180),
  toggles: z.object({ twoDoor: z.boolean(), fwpob: z.boolean() }),
  adjustments: z.record(z.string(), adjustmentSchema),
});

// Trimmed, at most 60 characters, and empty becomes null.
export const titleSchema = z
  .string()
  .trim()
  .max(60)
  .nullish()
  .transform((value) => value || null);

// Matches nanoid(8) with its default alphabet.
export function isSlug(value: string): boolean {
  return /^[A-Za-z0-9_-]{8}$/.test(value);
}

export function normalise(
  input: ScenarioInput,
  twoDoorAvailable: boolean,
): ScenarioInput {
  const adjustments: ScenarioInput["adjustments"] = {};
  for (const key of Object.keys(input.adjustments).sort()) {
    const { startDelay, extraDuration } = input.adjustments[key];
    if (startDelay === 0 && extraDuration === 0) continue;
    adjustments[key] = { startDelay, extraDuration };
  }

  return {
    aircraftType: input.aircraftType,
    sta: input.sta,
    std: input.std,
    arrivalDelay: input.arrivalDelay,
    toggles: {
      twoDoor: twoDoorAvailable && input.toggles.twoDoor,
      fwpob: input.toggles.fwpob,
    },
    adjustments,
  };
}

// Keys are written out in a fixed order so the string never depends on how the input was built.
export function hashScenario(
  input: ScenarioInput,
  title: string | null,
  templateVersion: number,
): string {
  const stable = JSON.stringify({
    aircraftType: input.aircraftType,
    sta: input.sta,
    std: input.std,
    arrivalDelay: input.arrivalDelay,
    toggles: { twoDoor: input.toggles.twoDoor, fwpob: input.toggles.fwpob },
    adjustments: Object.keys(input.adjustments)
      .sort()
      .map((key) => [
        key,
        input.adjustments[key].startDelay,
        input.adjustments[key].extraDuration,
      ]),
    title,
    templateVersion,
  });
  return createHash("sha256").update(stable).digest("hex");
}
