import {
  getLineupBySlot,
  getTeamServeAlignment,
  TEAM_SIDES,
  type CourtSessionTimeline,
  type MatchScore,
  type MemberId,
  type TeamSide,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { TeamColorName } from "../../../theme/team-colors";
import { stateOfTimeline } from "../model/court-screen.selectors";
import type { CourtRoster } from "../ports/court-roster";
import type { SubstitutionState } from "./substitution.reducer";

const FIRST_SLOT = 1;
const FREE_SYSTEM = "livre";

export interface SubstitutionTeam {
  readonly side: TeamSide;
  readonly label: string;
  readonly color: TeamColorName;
}

export interface SubstitutionRow {
  readonly memberId: MemberId;
  readonly name: string;
  readonly detail: string;
  readonly selected: boolean;
  readonly accessibilityLabel: string;
}

/** What screen 23a shows, all derived from the open match and the picks, which are checked here. */
export interface SubstitutionView {
  readonly teams: readonly SubstitutionTeam[];
  readonly team: TeamSide;
  readonly outgoing: readonly SubstitutionRow[];
  readonly incoming: readonly SubstitutionRow[];
  /** "Duda entra na posição 5, no lugar de Marcos. Marcos vai para o banco."; `null` until both picks. */
  readonly sentence: string | null;
  /** "Trocar Marcos por Duda"; `null` until both picks. */
  readonly confirmLabel: string | null;
  /** The picks that still hold, ready for the command. */
  readonly picks: { readonly outgoing: MemberId; readonly incoming: MemberId } | null;
}

/** Only a team with its rotation on has a bench, and only someone on the bench comes in (question 79). */
function hasBench(match: MatchScore, side: TeamSide): boolean {
  const benchSize = match.rotations[side]?.bench.length ?? 0;
  return benchSize > 0;
}

function substitutableTeams(match: MatchScore): readonly TeamSide[] {
  return TEAM_SIDES.filter((side) => hasBench(match, side));
}

/** The item "Trocar jogador" of the menu works only with someone on a bench. */
export function canSubstitute(timeline: CourtSessionTimeline): boolean {
  const match = stateOfTimeline(timeline).currentMatch;
  return match !== null && substitutableTeams(match).length > 0;
}

function outgoingDetail(match: MatchScore, side: TeamSide, memberId: MemberId, slot: number) {
  const { substitution } = strings.courtPlayers;
  const alignment = getTeamServeAlignment(match, side);
  const serving = match.currentSet?.servingTeam === side && slot === FIRST_SLOT;
  const setter =
    alignment !== null && alignment.system !== FREE_SYSTEM && alignment.actingSetter === memberId;
  return substitution.detail([
    substitution.position(slot),
    ...(serving ? [substitution.serving] : []),
    ...(setter ? [substitution.setter] : []),
  ]);
}

function row(memberId: MemberId, detail: string, selected: boolean, roster: CourtRoster) {
  const name = roster.nameOf(memberId);
  return {
    memberId,
    name,
    detail,
    selected,
    accessibilityLabel: strings.courtPlayers.substitution.rowLabel(name, detail),
  };
}

interface TeamOnCourt {
  readonly bySlot: readonly MemberId[];
  readonly bench: readonly MemberId[];
}

function teamOnCourt(match: MatchScore, side: TeamSide): TeamOnCourt | null {
  const teamState = match.rotations[side];
  return teamState === null
    ? null
    : { bySlot: getLineupBySlot(teamState.lineup, teamState.setterZone), bench: teamState.bench };
}

function validPick(pick: MemberId | null, among: readonly MemberId[]): MemberId | null {
  return pick !== null && among.includes(pick) ? pick : null;
}

function picksText(
  roster: CourtRoster,
  outgoing: MemberId,
  incoming: MemberId,
  position: number,
): { readonly sentence: string; readonly confirmLabel: string } {
  const { substitution } = strings.courtPlayers;
  const outName = roster.nameOf(outgoing);
  const inName = roster.nameOf(incoming);
  return {
    sentence: substitution.sentence(inName, position, outName),
    confirmLabel: substitution.confirm(outName, inName),
  };
}

interface Picks {
  readonly outgoing: MemberId;
  readonly incoming: MemberId;
}

function validPicks(state: SubstitutionState, court: TeamOnCourt): Picks | null {
  const outgoing = validPick(state.outgoing, court.bySlot);
  const incoming = validPick(state.incoming, court.bench);
  return outgoing === null || incoming === null ? null : { outgoing, incoming };
}

function rowsOf(
  match: MatchScore,
  team: TeamSide,
  court: TeamOnCourt,
  state: SubstitutionState,
  roster: CourtRoster,
) {
  const outgoing = validPick(state.outgoing, court.bySlot);
  const incoming = validPick(state.incoming, court.bench);
  return {
    outgoing: court.bySlot.map((memberId, index) =>
      row(
        memberId,
        outgoingDetail(match, team, memberId, index + FIRST_SLOT),
        memberId === outgoing,
        roster,
      ),
    ),
    incoming: court.bench.map((memberId) =>
      row(memberId, strings.courtPlayers.substitution.bench, memberId === incoming, roster),
    ),
  };
}

/** The team of the screen: the one picked while it still has a bench, else the first that has one. */
function chosenTeam(match: MatchScore, state: SubstitutionState): TeamSide | null {
  const sides = substitutableTeams(match);
  return sides.find((side) => side === state.team) ?? sides[0] ?? null;
}

/** Screen 23a, or `null` when nobody is on a bench (the menu keeps the item off then). */
export function substitutionView(
  timeline: CourtSessionTimeline,
  roster: CourtRoster,
  state: SubstitutionState,
): SubstitutionView | null {
  const match = stateOfTimeline(timeline).currentMatch;
  const team = match === null ? null : chosenTeam(match, state);
  const court = match === null || team === null ? null : teamOnCourt(match, team);
  if (match === null || team === null || court === null) {
    return null;
  }
  const picks = validPicks(state, court);
  const texts =
    picks === null
      ? null
      : picksText(
          roster,
          picks.outgoing,
          picks.incoming,
          court.bySlot.indexOf(picks.outgoing) + FIRST_SLOT,
        );
  return {
    teams: substitutableTeams(match).map((side) => ({
      side,
      ...roster.teamAppearance(match.matchId, side),
    })),
    team,
    ...rowsOf(match, team, court, state, roster),
    sentence: texts?.sentence ?? null,
    confirmLabel: texts?.confirmLabel ?? null,
    picks,
  };
}
