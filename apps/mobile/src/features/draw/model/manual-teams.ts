import type { MemberId, SettingsModality } from "@sacou/match-engine";
import { splitByArrival } from "@sacou/volley-rules";

import type { Round } from "../../../services/api/sacou-api";
import type { DrawArrangement } from "./draw-arrangement";

/** The team of each modality, as the server's `DrawRulesReader` reads it. */
const PLAYERS_PER_TEAM: Readonly<Record<SettingsModality, number>> = {
  "indoor-6x6": 6,
  "beach-4x4": 4,
  "beach-2x2": 2,
};

const NO_LEVELS: ReadonlyMap<MemberId, number> = new Map();

export function playersPerTeamOf(modality: SettingsModality): number {
  return PLAYERS_PER_TEAM[modality];
}

/**
 * "Montar times" with the draw off (question 72, ADR 0061): the confirmed, in order of arrival, fill the teams
 * one after the other and the last ones wait as reserves, by the rule the server draws with (golden
 * `draw-split.json`). No level: the arrangement has none, so the screen shows no note and no meter.
 * `null` with fewer than 4 confirmed.
 */
export function arrivalArrangement(
  round: Pick<Round, "going">,
  modality: SettingsModality,
): DrawArrangement | null {
  const confirmed = [...round.going]
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.memberId);
  const split = splitByArrival(confirmed, playersPerTeamOf(modality));
  return split.ok
    ? { teams: split.value.teams, reserves: split.value.reserves, levels: NO_LEVELS }
    : null;
}
