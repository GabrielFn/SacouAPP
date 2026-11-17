import { err, ok, type Result } from "../result.js";
import { HALF_UP_FACTOR } from "./constants.data.js";
import type { DrawBalance, DrawBalanceError } from "./types.js";

/**
 * A team's average, rounded to the tenth of a point (half up), from levels in whole tenths: 220 over 6 is
 * 36,67, shown as 3,7. Integers only, so the app and the server (`DrawBalance.cs`) never drift apart
 * (golden `draw-balance.json`, ADR 0055).
 */
export function teamAverageTenths(
  levelsTenths: readonly number[],
): Result<number, DrawBalanceError> {
  if (levelsTenths.length === 0) return err({ code: "empty-team" });
  const sum = levelsTenths.reduce((total, level) => total + level, 0);
  const size = levelsTenths.length;
  return ok(Math.floor((HALF_UP_FACTOR * sum + size) / (HALF_UP_FACTOR * size)));
}

/** The averages in the order of the teams, and the highest minus the lowest of the rounded averages. */
export function drawBalance(
  teamsLevelsTenths: readonly (readonly number[])[],
): Result<DrawBalance, DrawBalanceError> {
  if (teamsLevelsTenths.length === 0) return err({ code: "no-teams" });
  const results = teamsLevelsTenths.map((team) => teamAverageTenths(team));
  const averages = results.flatMap((result) => (result.ok ? [result.value] : []));
  if (averages.length < results.length) return err({ code: "empty-team" });
  return ok({
    averagesTenths: averages,
    differenceTenths: Math.max(...averages) - Math.min(...averages),
  });
}
