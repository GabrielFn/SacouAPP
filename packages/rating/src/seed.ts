import type { MemberLevel, RatingParams, Skill } from "./types.js";

/** Levels go in tenths: 30 is 3.0, the level of a member nobody rated (E1.3). */
export const TENTHS_PER_LEVEL = 10;
export const BASE_LEVEL_TENTHS = 30;
export const MIN_LEVEL_TENTHS = 10;
export const MAX_LEVEL_TENTHS = 50;

const HALF = 0.5;

/** μ of a level (ADR 0018 and 0071): `mu0 + (level − 3.0) × levelStep`, exact in tenths. */
export function muOfLevel(params: RatingParams, levelTenths: number): number {
  return params.mu0 + ((levelTenths - BASE_LEVEL_TENTHS) * params.levelStep) / TENTHS_PER_LEVEL;
}

/**
 * The starting skill of a member (question 98, option 1: the current level, so a new admin grade
 * rebuilds the pool). The admin grade is trusted, so its σ is low; a suggestion or the default 3.0
 * starts with a high σ and moves more.
 */
export function seedOf(params: RatingParams, level: MemberLevel): Skill {
  const sigma = level.source === "admin" ? params.sigmaAdmin : params.sigmaUnconfirmed;
  return { mu: muOfLevel(params, level.levelTenths), sigma };
}

/**
 * The level a μ stands for, in tenths, rounded half up and limited to 1.0 to 5.0. After the pilot
 * only (the rating stays hidden); the C# port rounds with `Math.Floor(x + 0.5)` to match.
 */
export function levelOf(params: RatingParams, mu: number): number {
  const tenths = BASE_LEVEL_TENTHS + ((mu - params.mu0) * TENTHS_PER_LEVEL) / params.levelStep;
  const rounded = Math.floor(tenths + HALF);
  return Math.min(MAX_LEVEL_TENTHS, Math.max(MIN_LEVEL_TENTHS, rounded));
}

export function isValidLevelTenths(levelTenths: number): boolean {
  return (
    Number.isInteger(levelTenths) &&
    levelTenths >= MIN_LEVEL_TENTHS &&
    levelTenths <= MAX_LEVEL_TENTHS
  );
}
