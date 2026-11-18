import type { CourtSessionTimeline, MatchScore, TeamSide } from "@sacou/match-engine";
import type { FormationPhase } from "@sacou/volley-rules";

import { lineupStrings } from "../../../strings/lineup.pt-BR";
import { selectCourtPhase, stateOfTimeline } from "../../court/model/court-screen.selectors";
import { menuSubtitle } from "../../court/model/menu-selectors";
import type { CourtRoster } from "../../court/ports/court-roster";
import type { LineupBase } from "./lineup-editor.reducer";
import type { LineupSource, LineupTeamSource } from "./lineup-source";

/**
 * The base of a team in a match moves with any event of the log: a point, a turn, another lineup.
 * The id of the last active event is the key, not the count: an undo drops events, so the count repeats.
 * So a draft that started before is ignored, never saved (D3, D7).
 */
export function matchBaseKey(timeline: CourtSessionTimeline): string {
  return timeline.entries.at(-1)?.event.eventId ?? "";
}

function baseOf(match: MatchScore, side: TeamSide, key: string): LineupBase | null {
  const state = match.rotations[side];
  // In a match, a libero who leaves goes to the end of the bench (ADR 0028, D5).
  return state === null ? null : { side, state, key, liberoExit: "bench" };
}

/** `null` between sets: the set is decided, or closed, and who serves next is not known yet (D7). */
function phaseOf(match: MatchScore, side: TeamSide, betweenSets: boolean): FormationPhase | null {
  const set = match.currentSet;
  if (set === null || betweenSets) return null;
  return set.servingTeam === side ? "serving" : "receiving";
}

interface TeamContext {
  readonly match: MatchScore;
  readonly roster: CourtRoster;
  readonly key: string;
  readonly betweenSets: boolean;
}

function teamSourceOf(context: TeamContext, side: TeamSide): LineupTeamSource {
  const { match, roster, key, betweenSets } = context;
  const appearance = roster.teamAppearance(match.matchId, side);
  const size = match.teams[side].memberIds.length;
  const base = baseOf(match, side, key);
  return {
    side,
    name: appearance.label,
    color: appearance.color,
    size,
    base,
    phase: phaseOf(match, side, betweenSets),
    liberoPool: base?.state.bench ?? [],
    noLiberoText: lineupStrings.noBenchForLibero(size),
  };
}

/**
 * Screen 22 opened by the menu of the match (D1, D7): every team, base and phase from the replay of
 * the log, names and positions from the roster. `null` without an open match.
 */
export function matchLineupSource(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
): LineupSource | null {
  const state = stateOfTimeline(timeline);
  const match = state.currentMatch;
  if (match === null) return null;
  const context: TeamContext = {
    match,
    roster,
    key: matchBaseKey(timeline),
    betweenSets: selectCourtPhase(state) === "set-decided",
  };
  return {
    subtitle: menuSubtitle(timeline, roster) ?? lineupStrings.betweenSets,
    teams: { a: teamSourceOf(context, "a"), b: teamSourceOf(context, "b") },
    nameOf: (memberId) => roster.nameOf(memberId),
    positionOf: (memberId) => roster.positionOf(memberId),
  };
}

/** Whether "Escalação" has anything to edit: at least one team of the open match rotates (D7). */
export function hasLineupToEdit(timeline: CourtSessionTimeline): boolean {
  const match = stateOfTimeline(timeline).currentMatch;
  return match !== null && (match.rotations.a !== null || match.rotations.b !== null);
}

const TEAM_PARAMS: Readonly<Record<string, TeamSide | undefined>> = { a: "a", b: "b" };

/** The `team` of the route: `a` or `b`; anything else opens team A (D7). */
export function teamOfParam(param: string | readonly string[] | undefined): TeamSide {
  return typeof param === "string" ? (TEAM_PARAMS[param] ?? "a") : "a";
}
