import { ROTATION_SLOTS } from "./constants.data.js";
import { deepFreeze } from "./deep-freeze.js";
import rawCatalog from "./formations.json" with { type: "json" };
import { parseFormationCatalog } from "./parse-catalog.js";
import type {
  Formation,
  FormationCatalog,
  FormationPhase,
  FormationSlot,
  FormationSystem,
  FormationTemplate,
  RotationKey,
  RotationSlot,
} from "./types.js";

export const FORMATION_CATALOG: FormationCatalog = parseFormationCatalog(rawCatalog);

type FormationSlots = Formation["slots"];

function buildSlots(readSlot: (slot: RotationSlot) => FormationSlot): FormationSlots {
  return Object.fromEntries(ROTATION_SLOTS.map((slot) => [slot, readSlot(slot)])) as Record<
    RotationSlot,
    FormationSlot
  >;
}

function receivingSlots({ receive }: FormationTemplate): FormationSlots {
  return buildSlots((slot) => {
    const { role, x, y } = receive[slot];
    return { role, point: { x, y } };
  });
}

function servingSlots({ receive, serveSubstitution }: FormationTemplate): FormationSlots {
  return buildSlots((slot) => ({
    role: serveSubstitution?.[slot] ?? receive[slot].role,
    point: FORMATION_CATALOG.basePositions[slot],
  }));
}

/** Returns `undefined` when the system does not use that rotation. */
export function getFormation(
  system: FormationSystem,
  rotation: RotationKey,
  phase: FormationPhase,
): Formation | undefined {
  const template = FORMATION_CATALOG.systems[system].rotations[rotation];
  if (template === undefined) {
    return undefined;
  }
  return deepFreeze({
    system,
    rotation,
    phase,
    slots: phase === "receiving" ? receivingSlots(template) : servingSlots(template),
    liberoReplaces: template.liberoReplaces,
    note: template.note,
  });
}
