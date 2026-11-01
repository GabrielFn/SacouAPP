import type { CourtPoint, Formation, FormationPhase, RotationSlot } from "../formations/index.js";
import { err, ok, type Result } from "../result.js";
import { DEFAULT_OVERLAP_TOLERANCE, OVERLAP_RELATIONS, SERVER_SLOT } from "./constants.data.js";
import type {
  FormationOverlapOptions,
  OverlapCheck,
  OverlapError,
  OverlapOptions,
  OverlapRelation,
  OverlapRuleMode,
} from "./types.js";

type PointAt = (slot: RotationSlot) => CourtPoint;

function isValidTolerance(tolerance: number): boolean {
  return Number.isFinite(tolerance) && tolerance >= 0;
}

function involvesServer(relation: OverlapRelation): boolean {
  const slots: readonly RotationSlot[] =
    relation.kind === "depth" ? [relation.back, relation.front] : [relation.left, relation.right];
  return slots.includes(SERVER_SLOT);
}

function relationsInForce(
  mode: OverlapRuleMode,
  phase: FormationPhase,
): readonly OverlapRelation[] {
  if (phase === "receiving") {
    return OVERLAP_RELATIONS;
  }
  return mode === "fivb-2025-28"
    ? []
    : OVERLAP_RELATIONS.filter((relation) => !involvesServer(relation));
}

/** Both comparisons are false for `NaN`, so a bad coordinate fails instead of passing. */
function holds(relation: OverlapRelation, pointAt: PointAt, tolerance: number): boolean {
  return relation.kind === "depth"
    ? pointAt(relation.back).y >= pointAt(relation.front).y - tolerance
    : pointAt(relation.left).x < pointAt(relation.right).x;
}

function checkRelations(
  pointAt: PointAt,
  { mode, phase, tolerance = DEFAULT_OVERLAP_TOLERANCE }: OverlapOptions,
): Result<OverlapCheck, OverlapError> {
  if (!isValidTolerance(tolerance)) {
    return err({ code: "invalid-tolerance" });
  }
  const relations = relationsInForce(mode, phase);
  const violations = relations
    .filter((relation) => !holds(relation, pointAt, tolerance))
    .map(({ id }) => id);
  return violations.length > 0
    ? err({ code: "overlap", violations })
    : ok({ checked: relations.map(({ id }) => id) });
}

export function validateOverlap(
  positions: Readonly<Record<RotationSlot, CourtPoint>>,
  options: OverlapOptions,
): Result<OverlapCheck, OverlapError> {
  return checkRelations((slot) => positions[slot], options);
}

/** Takes the phase from the formation and ignores roles: the libero counts in the place taken. */
export function validateFormationOverlap(
  formation: Formation,
  options: FormationOverlapOptions,
): Result<OverlapCheck, OverlapError> {
  return checkRelations((slot) => formation.slots[slot].point, {
    ...options,
    phase: formation.phase,
  });
}
