import { formatClock, toMinutes } from "./clock";
import type { AircraftTypeId, ScenarioInput, Toggles } from "./types";

type AircraftDefaults = {
  id: AircraftTypeId;
  twoDoorAvailable: boolean;
  defaultTwoDoor: boolean;
  defaultGroundMinutes: number;
};

export const DEFAULT_STA = "14:05";

export function defaultToggles(aircraft: AircraftDefaults): Toggles {
  return { twoDoor: aircraft.twoDoorAvailable && aircraft.defaultTwoDoor, fwpob: false };
}

export function defaultInput(aircraft: AircraftDefaults): ScenarioInput {
  return {
    aircraftType: aircraft.id,
    sta: DEFAULT_STA,
    std: formatClock(toMinutes(DEFAULT_STA) + aircraft.defaultGroundMinutes),
    arrivalDelay: 0,
    toggles: defaultToggles(aircraft),
    adjustments: {},
  };
}

// The engine expects twoDoor off when the type can't board through two doors.
export function effectiveToggles(toggles: Toggles, twoDoorAvailable: boolean): Toggles {
  return { ...toggles, twoDoor: twoDoorAvailable && toggles.twoDoor };
}
