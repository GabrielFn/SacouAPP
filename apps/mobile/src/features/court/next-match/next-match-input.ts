import type {
  FinishedMatch,
  GroupSettings,
  MemberId,
  NextMatchInput,
  QueueExitChoices,
  QueueExitMode,
  TeamQueue,
  TeamSide,
  WinnerExit,
} from "@sacou/match-engine";

import { playersPerTeamOf } from "../../draw/model/manual-teams";
import type { NextMatchDraft } from "../ports/next-match-draft-store";

/** The confirmed of the round in order of arrival, as `going` holds them (`going` and `promoted`). */
export interface ArrivalEntry {
  readonly memberId: MemberId;
  readonly position: number;
}

/**
 * The order of arrival the criteria read: the confirmed of the round in order, then anyone on the
 * court or in the queue who is not on the list (a guest taken out later, an old cache), in the order
 * of the teams, so the engine never turns the plan down for a missing candidate (D7).
 */
export function arrivalOrderOf(
  confirmed: readonly ArrivalEntry[],
  finished: FinishedMatch,
  queue: TeamQueue,
): readonly MemberId[] {
  const listed = [...confirmed]
    .sort((left, right) => left.position - right.position)
    .map(({ memberId }) => memberId);
  const present = [
    ...finished.teams.a.memberIds,
    ...finished.teams.b.memberIds,
    ...queue.teams.flatMap(({ memberIds }) => memberIds),
    ...queue.players,
  ];
  return [...new Set([...listed, ...present])];
}

function exitModeOf({ queue }: GroupSettings): QueueExitMode {
  switch (queue.exitMode) {
    case "fixed-count":
      return { kind: "fixed-count", count: queue.fixedExitCount };
    case "whole-team":
      return { kind: "whole-team" };
    case "automatic":
      return { kind: "automatic" };
  }
}

function winnerExitOf({ queue }: GroupSettings): WinnerExit | null {
  return queue.winnerExitEnabled ? { wins: queue.winnerExitWins } : null;
}

function otherSide(side: TeamSide): TeamSide {
  return side === "a" ? "b" : "a";
}

export interface ChoiceContext {
  readonly arrivalOrder: readonly MemberId[];
  readonly draft: NextMatchDraft;
  /** `null` without a winner: nobody leaves, and either side may be read. */
  readonly winner: TeamSide | null;
}

function sidesOf({ winner }: ChoiceContext): {
  readonly loser: TeamSide;
  readonly winner: TeamSide;
} {
  const won = winner ?? "a";
  return { loser: otherSide(won), winner: won };
}

/** The criterion of the round with the input of each team (the winner's only when it leaves too). */
export function exitChoicesOf(
  criterion: GroupSettings["queue"]["exitCriterion"],
  context: ChoiceContext,
  withWinner: boolean,
): QueueExitChoices {
  const sides = sidesOf(context);
  const forWinner = <T>(input: T): T | null => (withWinner ? input : null);
  switch (criterion) {
    case "consecutive-matches":
    case "arrival-order": {
      const input = { arrivalOrder: context.arrivalOrder };
      return { criterion, criterionInput: input, winnerCriterionInput: forWinner(input) };
    }
    case "draw": {
      const order = context.draft.drawOrder ?? { a: [], b: [] };
      return {
        criterion,
        criterionInput: { drawOrder: order[sides.loser] },
        winnerCriterionInput: forWinner({ drawOrder: order[sides.winner] }),
      };
    }
    case "manual":
      return {
        criterion,
        criterionInput: { chosen: context.draft.chosen[sides.loser] },
        winnerCriterionInput: forWinner({ chosen: context.draft.chosen[sides.winner] }),
      };
  }
}

/**
 * The input of `planNextMatch` from the resolved settings of the round (E4.7 D8): the mode, the
 * "vencedor também sai" and the size of a team; with it on, the winner gets its input too.
 */
export function nextMatchInput(settings: GroupSettings, context: ChoiceContext): NextMatchInput {
  return {
    ...exitChoicesOf(settings.queue.exitCriterion, context, settings.queue.winnerExitEnabled),
    exitMode: exitModeOf(settings),
    playersPerTeam: playersPerTeamOf(settings.format.modality),
    winnerExit: winnerExitOf(settings),
  };
}
