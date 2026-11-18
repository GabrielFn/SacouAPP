import {
  getLineupBySlot,
  getWinStreak,
  type CourtSessionState,
  type FinishedMatch,
  type MemberId,
  type NextMatchPlan,
  type PartialExit,
  type QueueExitCriterionKey,
  type SetScore,
  type TeamQueue,
  type TeamSide,
  type TeamState,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { TeamColorName } from "../../../theme/team-colors";
import type { CourtRoster } from "../ports/court-roster";

const SIDES: readonly TeamSide[] = ["a", "b"];
const FIRST_SLOT = 1;
/** A streak is told from the second win in a row ("2ª seguida"). */
const STREAK_SHOWN_FROM = 2;

export interface ResultView {
  readonly heading: string;
  readonly winner: TeamSide | null;
  readonly winnerText: string;
  readonly winnerColor: TeamColorName | null;
  readonly lastSet: string;
  readonly sets: string;
  /** "3ª seguida" by `getWinStreak` of the engine (same members), from the second win. */
  readonly streak: string | null;
}

export interface ExitRow {
  readonly memberId: MemberId;
  readonly name: string;
  readonly detail: string | null;
}

export interface ExitRows {
  readonly leaving: readonly ExitRow[];
  readonly entering: readonly ExitRow[];
  /** "Davi entra no lugar de Rafa e Sofia no de Duda. Rafa e Duda vão para o fim da fila." */
  readonly swaps: string | null;
}

function otherSide(side: TeamSide): TeamSide {
  return side === "a" ? "b" : "a";
}

function labelOf(roster: CourtRoster, matchId: string, side: TeamSide): string {
  return roster.teamAppearance(matchId, side).label;
}

interface LastScore {
  readonly setNumber: number;
  readonly score: SetScore;
}

/** The set the match ended in: the open one of a manual end, or the last one played. */
function lastScore(match: FinishedMatch): LastScore {
  const open = match.endReason === "manual" ? match.currentSet : null;
  return open ?? match.completedSets.at(-1) ?? { setNumber: FIRST_SLOT, score: { a: 0, b: 0 } };
}

function streakOf(state: CourtSessionState, winner: TeamSide | null): string | null {
  if (winner === null) return null;
  const wins = getWinStreak(state, winner);
  return wins >= STREAK_SHOWN_FROM ? strings.court.matchEnd.streak(wins) : null;
}

/** The left column of screen 11: how the match ended, the winner's numbers first. */
export function resultView(
  state: CourtSessionState,
  match: FinishedMatch,
  roster: CourtRoster,
): ResultView {
  const { matchEnd } = strings.court;
  const { winner } = match;
  const last = lastScore(match);
  const first = winner ?? "a";
  const second = otherSide(first);
  return {
    heading:
      match.endReason === "manual"
        ? matchEnd.headingManual(last.setNumber)
        : matchEnd.heading(last.setNumber),
    winner,
    winnerText:
      winner === null ? matchEnd.noWinner : matchEnd.winner(labelOf(roster, match.matchId, winner)),
    winnerColor: winner === null ? null : roster.teamAppearance(match.matchId, winner).color,
    lastSet: matchEnd.lastSet(last.score[first], last.score[second]),
    sets: matchEnd.sets(match.setsWon[first], match.setsWon[second]),
    streak: streakOf(state, winner),
  };
}

function waitingCount({ players, teams }: TeamQueue): number {
  return players.length + teams.reduce((sum, { memberIds }) => sum + memberIds.length, 0);
}

function names(roster: CourtRoster, memberIds: readonly MemberId[]): string {
  return strings.court.names.join(memberIds.map((id) => roster.nameOf(id)));
}

export interface ExplanationContext {
  /** The state right after the match: its queue is who was waiting. */
  readonly state: CourtSessionState;
  readonly match: FinishedMatch;
  readonly plan: NextMatchPlan;
  readonly criterion: QueueExitCriterionKey;
  readonly fixedCount: boolean;
  readonly roster: CourtRoster;
}

function leadOf(context: ExplanationContext, side: TeamSide): string {
  const { matchEnd } = strings.court;
  const label = labelOf(context.roster, context.match.matchId, side);
  const leaving = context.plan.winnerLeaving;
  return leaving?.side === side ? matchEnd.winnerLeft(label, leaving.streak) : matchEnd.lost(label);
}

function bodyOf(context: ExplanationContext, side: TeamSide): string | null {
  const { matchEnd } = strings.court;
  const { plan, roster, match } = context;
  if (plan.enteringTeams.includes(side)) {
    return matchEnd.teamEnters(names(roster, plan.teams[side].memberIds));
  }
  const leaving = plan.exits.filter((exit) => exit.side === side).length;
  if (leaving === 0) return null;
  const label = labelOf(roster, match.matchId, side);
  const criterion = matchEnd.criteria[context.criterion];
  return context.fixedCount
    ? matchEnd.fixedExit(label, leaving, criterion)
    : matchEnd.partialExit(label, waitingCount(context.state.queue), leaving, criterion);
}

/** Who leaves first: the winner that leaves too, then the loser (ADR 0050). */
function leavingSides({ plan }: ExplanationContext, winner: TeamSide): readonly TeamSide[] {
  const loser = otherSide(winner);
  return plan.winnerLeaving === null ? [loser] : [winner, loser];
}

/** Why the next match is what it is, one sentence per case (D6). */
export function planExplanation(context: ExplanationContext): string {
  const { matchEnd } = strings.court;
  const { winner } = context.match;
  if (waitingCount(context.state.queue) === 0) return matchEnd.sameTeams;
  if (winner === null) return matchEnd.nobodyLeaves;
  return leavingSides(context, winner)
    .flatMap((side) => {
      const body = bodyOf(context, side);
      return body === null ? [] : [matchEnd.sentence(leadOf(context, side), body)];
    })
    .join(" ");
}

/** The slot of the court of an index of `lineup`, by the setter zone at the end of the match. */
function slotOf({ lineup, setterZone }: TeamState, index: number): number {
  const indexes = lineup.map((_, at) => at);
  return getLineupBySlot(indexes, setterZone).indexOf(index);
}

/** The position the one coming in takes: the slot of the court, never the raw index (pendência 22). */
function placeText(match: FinishedMatch, exit: PartialExit): string | null {
  const { matchEnd } = strings.court;
  const { place } = exit;
  const rotation = match.rotations[exit.side];
  switch (place.area) {
    case "lineup":
      return rotation === null
        ? null
        : matchEnd.position(slotOf(rotation, place.index) + FIRST_SLOT);
    case "bench":
      return matchEnd.bench;
    case "libero":
      return matchEnd.benchEnd;
    case "team":
      return null;
  }
}

function swapsText(roster: CourtRoster, exits: readonly PartialExit[]): string | null {
  const { matchEnd } = strings.court;
  const [first, ...rest] = exits;
  if (first === undefined) return null;
  const pairs = [
    matchEnd.firstSwap(roster.nameOf(first.incoming), roster.nameOf(first.outgoing)),
    ...rest.map((exit) =>
      matchEnd.nextSwap(roster.nameOf(exit.incoming), roster.nameOf(exit.outgoing)),
    ),
  ];
  const outgoing = exits.map((exit) => exit.outgoing);
  return matchEnd.swaps(strings.court.names.join(pairs), names(roster, outgoing), outgoing.length);
}

/** "Saem" and "Entram" of screen 11, from the partial exits of the plan. */
export function exitRows(match: FinishedMatch, plan: NextMatchPlan, roster: CourtRoster): ExitRows {
  const { matchEnd } = strings.court;
  return {
    leaving: plan.exits.map((exit) => ({
      memberId: exit.outgoing,
      name: roster.nameOf(exit.outgoing),
      detail: matchEnd.streakOf(exit.consecutiveMatches),
    })),
    entering: plan.exits.map((exit) => ({
      memberId: exit.incoming,
      name: roster.nameOf(exit.incoming),
      detail: placeText(match, exit),
    })),
    swaps: swapsText(roster, plan.exits),
  };
}

/** "(com Davi e Sofia)" of "Próxima: A Laranja x B Azul": the names that come in, if any. */
export function nextWith(plan: NextMatchPlan, roster: CourtRoster): string | null {
  const incoming = [
    ...plan.exits.map((exit) => exit.incoming),
    ...plan.enteringTeams.flatMap((side) => plan.teams[side].memberIds),
  ];
  return incoming.length === 0 ? null : strings.court.matchEnd.nextWith(names(roster, incoming));
}

export interface ManualPick {
  readonly side: TeamSide;
  readonly label: string;
  readonly required: number;
  readonly candidates: readonly { readonly memberId: MemberId; readonly name: string }[];
}

/**
 * With the criterion `manual`, each team that loses players (by the preview of the plan) picks
 * exactly that many of its own; a team that leaves whole has nothing to pick.
 */
export function manualPicks(
  match: FinishedMatch,
  preview: NextMatchPlan,
  roster: CourtRoster,
): readonly ManualPick[] {
  return SIDES.flatMap((side) => {
    const required = preview.exits.filter((exit) => exit.side === side).length;
    if (required === 0) return [];
    const candidates = match.teams[side].memberIds.map((memberId) => ({
      memberId,
      name: roster.nameOf(memberId),
    }));
    return [{ side, label: labelOf(roster, match.matchId, side), required, candidates }];
  });
}

/** "Confirmar" waits for every pick of the criterion `manual` to be complete. */
export function picksComplete(
  picks: readonly ManualPick[],
  chosen: Readonly<Record<TeamSide, readonly MemberId[]>>,
): boolean {
  return picks.every((pick) => chosen[pick.side].length === pick.required);
}
