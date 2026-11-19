import type { CourtSessionTimeline } from "../corrections/types.js";
import type { SettingsModality } from "../settings/types.js";
import { getBeachRanking } from "./beach-ranking.js";
import { BEACH_MODALITIES, MVP_FORMULA_VERSION } from "./constants.data.js";
import { getMatchResults } from "./match-results.js";
import { getPlayerMvp, getTeamMvp } from "./mvp.js";
import { getPlayerStats } from "./player-stats.js";
import { NO_POINTS } from "./points-by-kind.js";
import { getSideHighlights } from "./side-highlights.js";
import { getSideStats } from "./side-stats.js";
import type {
  BeachTeamStanding,
  DayMvp,
  FinishedMatchResult,
  PlayerStats,
  RoundSummaryOptions,
  RoundSummary,
} from "./types.js";

export function isBeachModality(modality: SettingsModality): boolean {
  return (BEACH_MODALITIES as readonly SettingsModality[]).includes(modality);
}

/**
 * With "pontos individuais" off the attributions still arrive (the server never refuses them, the
 * option may change during the round), but they credit nobody (E3.9, 3.5).
 */
function playersOf(
  timeline: CourtSessionTimeline,
  individualPoints: boolean,
): readonly PlayerStats[] {
  const players = getPlayerStats(timeline);
  return individualPoints
    ? players
    : players.map((player) => ({ ...player, pointsByKind: NO_POINTS }));
}

function mvpOf(
  { mvpEnabled, mvpByStats }: RoundSummaryOptions,
  players: readonly PlayerStats[],
  finishedMatches: readonly FinishedMatchResult[],
  ranking: readonly BeachTeamStanding[] | null,
): DayMvp | null {
  if (!mvpEnabled || !mvpByStats) {
    return null;
  }
  return ranking === null ? getPlayerMvp(players, finishedMatches) : getTeamMvp(ranking);
}

/**
 * The after-game of a court session, computed from the timeline and the options of the round, never
 * recorded (E3.9): the finished matches, the statistics of each member, the highlights by side, the
 * MVP of the day from the scoreboard and, on the sand only, the ranking of the day. The open match
 * counts nothing. The key order is the contract with the C# port.
 */
export function getRoundSummary(
  timeline: CourtSessionTimeline,
  options: RoundSummaryOptions,
): RoundSummary {
  const finishedMatches = getMatchResults(timeline);
  const players = playersOf(timeline, options.individualPoints);
  const ranking = isBeachModality(options.modality) ? getBeachRanking(finishedMatches) : null;
  return {
    mvpFormulaVersion: MVP_FORMULA_VERSION,
    finishedMatches,
    players,
    sides: getSideHighlights(getSideStats(timeline)),
    mvp: mvpOf(options, players, finishedMatches, ranking),
    ranking,
  };
}
