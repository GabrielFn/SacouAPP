import type { TeamSide, TeamState } from "@sacou/match-engine";

import { lineupStrings } from "../../../strings/lineup.pt-BR";
import type { TeamColorName } from "../../../theme/team-colors";
import type { LineupBase } from "../../lineup/model/lineup-editor.reducer";
import type { LineupDraft } from "../../lineup/model/lineup-moves";
import type { LineupSource, LineupTeamSource } from "../../lineup/model/lineup-source";
import type { DrawNameOf } from "./draw-names";
import { teamOfSide, teamRotation, type MatchStartInput } from "./match-start";
import type { SavedLineups } from "./pre-game";
import { toSavedLineup } from "./pre-game-lineup";
import { sideIdentity } from "./pre-game-selectors";

const SIDE_COLORS: Readonly<Record<TeamSide, TeamColorName>> = { a: "orange", b: "blue" };

/** The base moves when the team or its system changes on the 07 or the 08 (D3). */
function baseKey(team: readonly string[], rotation: TeamState): string {
  return `${rotation.system}:${team.join()}`;
}

function baseOf(input: MatchStartInput, side: TeamSide): LineupBase | null {
  const rotation = teamRotation(input, side);
  if (rotation === null) return null;
  const key = baseKey(teamOfSide(input.arrangement, side), rotation);
  // In the pre-game a libero who leaves goes back to the queue, never to a bench (D5).
  return { side, state: rotation, key, liberoExit: "out" };
}

function teamSourceOf(input: MatchStartInput, side: TeamSide): LineupTeamSource {
  return {
    side,
    name: sideIdentity(side).name,
    color: SIDE_COLORS[side],
    size: teamOfSide(input.arrangement, side).length,
    base: baseOf(input, side),
    phase: input.preGame.firstServer === side ? "serving" : "receiving",
    liberoPool: input.arrangement.reserves,
    benchPool: input.arrangement.reserves,
    noLiberoText: lineupStrings.noReserves,
  };
}

/**
 * Screen 22 opened by the 08 (D1): the teams, the lineups they start with and the reserves, read from
 * the flow of the 07. Only IDs, names and positions go: never the levels of the draw (ADR 0061).
 */
export function preGameLineupSource(
  input: MatchStartInput,
  nameOf: DrawNameOf,
  matchNumber: number,
): LineupSource {
  return {
    subtitle: lineupStrings.beforeStart(matchNumber),
    teams: { a: teamSourceOf(input, "a"), b: teamSourceOf(input, "b") },
    nameOf,
    positionOf: input.positionOf,
  };
}

/** What "Salvar escalação" keeps on the 08: each changed team with the system it holds for. */
export function savedLineupsOf(
  drafts: Readonly<Partial<Record<TeamSide, LineupDraft>>>,
): SavedLineups {
  return Object.fromEntries(
    Object.entries(drafts).map(([side, draft]) => [side, toSavedLineup(draft)] as const),
  );
}
