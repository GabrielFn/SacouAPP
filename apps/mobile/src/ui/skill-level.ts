/**
 * The scale of a level (`SkillLevel`, `docs/dominio/perfil-e-nota.md`): 1.0 to 5.0 by half points, kept in
 * whole tenths (10 to 50, by 5) so no sum ever drifts. The server has the last word: this only draws the
 * steps and never sends a value outside them.
 */
export const SKILL_LEVEL = { minTenths: 10, maxTenths: 50, stepTenths: 5, defaultTenths: 30 } as const;

const TENTHS_PER_POINT = 10;
const DECIMALS = 1;

/** A level in tenths: 35 is 3,5. */
export type LevelTenths = number;

/** The whole points 1 to 5, the shortcuts of the sheet 19a. */
export const LEVEL_SHORTCUTS: readonly LevelTenths[] = Array.from(
  { length: (SKILL_LEVEL.maxTenths - SKILL_LEVEL.minTenths) / TENTHS_PER_POINT + 1 },
  (_, index) => SKILL_LEVEL.minTenths + index * TENTHS_PER_POINT,
);

export function isOnScale(tenths: number): boolean {
  return (
    Number.isInteger(tenths) &&
    tenths >= SKILL_LEVEL.minTenths &&
    tenths <= SKILL_LEVEL.maxTenths &&
    (tenths - SKILL_LEVEL.minTenths) % SKILL_LEVEL.stepTenths === 0
  );
}

/** A level of the API (`3.5`) in tenths, or `null` when absent or off the scale (never rounded). */
export function tenthsOf(level: number | null): LevelTenths | null {
  if (level === null) return null;
  const tenths = level * TENTHS_PER_POINT;
  const whole = Math.round(tenths);
  // 3.5 * 10 may come as 35.000000000000004: only that float noise is forgiven, never 3.25.
  return Math.abs(tenths - whole) < Number.EPSILON * TENTHS_PER_POINT && isOnScale(whole)
    ? whole
    : null;
}

/** Tenths back to the number of the wire. */
export function levelOf(tenths: LevelTenths): number {
  return tenths / TENTHS_PER_POINT;
}

export type StepDirection = -1 | 1;

export function canStep(tenths: LevelTenths, direction: StepDirection): boolean {
  return isOnScale(tenths + direction * SKILL_LEVEL.stepTenths);
}

/** Half a point up or down; at a limit it stays. */
export function stepLevel(tenths: LevelTenths, direction: StepDirection): LevelTenths {
  return canStep(tenths, direction) ? tenths + direction * SKILL_LEVEL.stepTenths : tenths;
}

/** "3,5": a comma, always one decimal. */
export function formatLevel(tenths: LevelTenths): string {
  return levelOf(tenths).toFixed(DECIMALS).replace(".", ",");
}
