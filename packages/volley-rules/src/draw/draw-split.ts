import { err, ok, type Result } from "../result.js";
import { MIN_DRAW_PLAYERS, MIN_DRAW_TEAMS } from "./constants.data.js";
import type { DrawLayout, DrawSplit, DrawSplitError } from "./types.js";

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * How many teams, of what size, and how many reserves (docs/dominio/sorteio.md, questions 52 and 53): as many
 * full teams as fit; with fewer than two, two teams of half the players. Every team has the same size. The
 * same rule as the C# `TeamLayout` (golden `draw-split.json`).
 */
export function drawLayout(
  playerCount: number,
  playersPerTeam: number,
): Result<DrawLayout, DrawSplitError> {
  if (!isPositiveInteger(playersPerTeam) || !Number.isInteger(playerCount)) {
    return err({ code: "invalid-size" });
  }
  if (playerCount < MIN_DRAW_PLAYERS) return err({ code: "not-enough-players" });
  const fullTeams = Math.floor(playerCount / playersPerTeam);
  const teamCount = Math.max(fullTeams, MIN_DRAW_TEAMS);
  const teamSize =
    fullTeams >= MIN_DRAW_TEAMS ? playersPerTeam : Math.floor(playerCount / MIN_DRAW_TEAMS);
  return ok({ teamCount, teamSize, reserveCount: playerCount - teamCount * teamSize });
}

/**
 * "Montar times" with the draw off (question 72): the players, in order of arrival, fill the teams one after
 * the other, and the last ones to arrive wait as reserves (question 52). No level is read.
 */
export function splitByArrival<T>(
  players: readonly T[],
  playersPerTeam: number,
): Result<DrawSplit<T>, DrawSplitError> {
  const layout = drawLayout(players.length, playersPerTeam);
  if (!layout.ok) return layout;
  const { teamCount, teamSize } = layout.value;
  const teams = Array.from({ length: teamCount }, (_, team) =>
    players.slice(team * teamSize, (team + 1) * teamSize),
  );
  return ok({ teams, reserves: players.slice(teamCount * teamSize) });
}
