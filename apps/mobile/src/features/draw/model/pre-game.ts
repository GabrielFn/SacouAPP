import { SETTINGS_CATALOG, type BestOf, type TeamSide } from "@sacou/match-engine";
import type { FormationSystem } from "@sacou/volley-rules";

/**
 * The choices of sheet 08 that differ from the round (D3, D6): `null` keeps the resolved setting, which
 * is the base and is never copied here. Coming back to the base drops the override.
 */
export interface PreGameChoices {
  readonly pointsPerSet: number | null;
  readonly bestOf: BestOf | null;
  readonly firstServer: TeamSide;
  readonly systems: Readonly<Record<TeamSide, FormationSystem | null>>;
  /** Which team the rotation picker shows. */
  readonly rotationTab: TeamSide;
}

/** Team A serves first unless the admin picks or flips (a small decision of D6). */
export const initialPreGameChoices: PreGameChoices = {
  pointsPerSet: null,
  bestOf: null,
  firstServer: "a",
  systems: { a: null, b: null },
  rotationTab: "a",
};

/** The value the admin picked, or `null` when it is the base again. */
export function overrideOf<T>(value: T, base: T): T | null {
  return value === base ? null : value;
}

export function chosenOr<T>(override: T | null, base: T): T {
  return override ?? base;
}

export interface PointsRange {
  readonly min: number;
  readonly max: number;
}

function pointsRange(): PointsRange {
  const field = SETTINGS_CATALOG.fields.find((entry) => entry.path === "scoring.pointsPerSet");
  if (field?.min == null || field.max == null) throw new Error("No range for scoring.pointsPerSet");
  return { min: field.min, max: field.max };
}

/** The limits of "Pontos por set", read from the catalog and never written by hand (D6). */
export const POINTS_PER_SET_RANGE: PointsRange = pointsRange();

/** One step of the stepper from the shown value, held inside the catalog limits. */
export function steppedPoints(shown: number, delta: number): number {
  return Math.min(POINTS_PER_SET_RANGE.max, Math.max(POINTS_PER_SET_RANGE.min, shown + delta));
}
