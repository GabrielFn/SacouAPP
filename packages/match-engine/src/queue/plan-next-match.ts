import { err, ok, type Result } from "@sacou/volley-rules";

import { MAX_QUEUE_MEMBERS, MAX_TEAM_MEMBERS, TEAM_SIDES } from "../score/constants.data.js";
import { queueSize } from "../score/queue-rules.js";
import type {
  CourtSessionState,
  FinishedMatch,
  MemberId,
  TeamQueue,
  TeamRoster,
  TeamSide,
} from "../score/types.js";
import { getWinStreak } from "./consecutive-matches.js";
import {
  MAX_WINNER_EXIT_WINS,
  MIN_PLAYERS_PER_TEAM,
  MIN_WINNER_EXIT_WINS,
} from "./constants.data.js";
import { isQueueExitMode, runExitStep } from "./exit-modes.js";
import type { ExitStepOutcome } from "./exit-steps.js";
import type {
  NextMatchInput,
  NextMatchPlan,
  NextMatchResult,
  QueueCommandError,
  QueueRefusalCode,
  QueueSideChoice,
  WinnerLeaving,
} from "./types.js";

function otherSide(side: TeamSide): TeamSide {
  return side === TEAM_SIDES[0] ? TEAM_SIDES[1] : TEAM_SIDES[0];
}

function isIntegerFrom(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isWinnerExit(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  const wins = typeof value === "object" ? (value as { readonly wins?: unknown }).wins : undefined;
  return isIntegerFrom(wins, MIN_WINNER_EXIT_WINS, MAX_WINNER_EXIT_WINS);
}

/** The first refusal of the input, in the order of ADR 0050; `null` when it can be planned. */
function refusalOf(state: CourtSessionState, input: NextMatchInput): QueueRefusalCode | null {
  if (state.currentMatch !== null) {
    return "match-already-open";
  }
  if (state.finishedMatches.length === 0) {
    return "no-finished-match";
  }
  if (!isIntegerFrom(input.playersPerTeam, MIN_PLAYERS_PER_TEAM, MAX_TEAM_MEMBERS)) {
    return "invalid-players-per-team";
  }
  if (!isQueueExitMode(input.exitMode)) {
    return "invalid-exit-mode";
  }
  return isWinnerExit(input.winnerExit) ? null : "invalid-winner-exit";
}

/** Single players who add up to a team form one, by order of arrival (`decisoes.md:11`). */
function formTeams(
  teams: readonly TeamRoster[],
  players: readonly MemberId[],
  playersPerTeam: number,
): TeamQueue {
  if (players.length < playersPerTeam) {
    return { players, teams };
  }
  const formed = { memberIds: players.slice(0, playersPerTeam) };
  return formTeams([...teams, formed], players.slice(playersPerTeam), playersPerTeam);
}

/** The winner leaves too when it has at least `wins` wins in a row (ADR 0050). */
function winnerLeavingOf(
  state: CourtSessionState,
  winner: TeamSide,
  input: NextMatchInput,
): WinnerLeaving | null {
  const streak = getWinStreak(state, winner);
  return input.winnerExit !== null && streak >= input.winnerExit.wins
    ? { side: winner, streak }
    : null;
}

/**
 * Who leaves, in order: the winner first when it leaves too, with the whole queue, and then the
 * loser with what is left (question P1 of E2.12, recommendation adopted).
 */
function exitOrder(winner: TeamSide, winnerLeaves: boolean): readonly TeamSide[] {
  const loser = otherSide(winner);
  return winnerLeaves ? [winner, loser] : [loser];
}

/** The loser chooses with `criterionInput`, and the winner with `winnerCriterionInput`. */
function choiceFor(input: NextMatchInput, isWinner: boolean): QueueSideChoice {
  const { criterion, criterionInput, winnerCriterionInput } = input;
  return { criterion, criterionInput: isWinner ? winnerCriterionInput : criterionInput };
}

interface SideStep {
  readonly outcome: ExitStepOutcome;
  readonly side: TeamSide;
}

type StepsResult = Result<readonly SideStep[], QueueCommandError>;

/** The queue the next step sees: what the last one left, or the queue of the round. */
function poolAfter(state: CourtSessionState, steps: readonly SideStep[]): TeamQueue {
  return steps.at(-1)?.outcome.pool ?? state.queue;
}

/** Runs the steps in order over one shared queue; whoever leaves only joins it at the end. */
function runSteps(
  state: CourtSessionState,
  match: FinishedMatch,
  input: NextMatchInput,
  sides: readonly TeamSide[],
): StepsResult {
  return sides.reduce<StepsResult>((done, side) => {
    if (!done.ok) {
      return done;
    }
    const context = {
      choice: choiceFor(input, side === match.winner),
      pool: poolAfter(state, done.value),
      roster: match.teams[side],
      rotation: match.rotations[side],
      side,
      state,
    };
    const ran = runExitStep(context, input.exitMode);
    return ran.ok ? ok([...done.value, { outcome: ran.value, side }]) : ran;
  }, ok([]));
}

function bySide(first: SideStep, second: SideStep): number {
  return TEAM_SIDES.indexOf(first.side) - TEAM_SIDES.indexOf(second.side);
}

/** The match after the steps: who left joins the queue, the winner's first, each in team order. */
function assemblePlan(
  state: CourtSessionState,
  match: FinishedMatch,
  steps: readonly SideStep[],
  winnerLeaving: WinnerLeaving | null,
): NextMatchPlan {
  const pool = poolAfter(state, steps);
  const leaving = steps.map(({ outcome }) => outcome.leaving);
  const inSideOrder = [...steps].sort(bySide);
  const outcomeOf = (side: TeamSide) => steps.find((step) => step.side === side)?.outcome;
  const [a, b] = [outcomeOf("a"), outcomeOf("b")];
  return {
    enteringTeams: inSideOrder.filter(({ outcome }) => outcome.entered).map(({ side }) => side),
    exits: inSideOrder.flatMap(({ outcome }) => outcome.exits),
    queue: {
      players: [...pool.players, ...leaving.flatMap(({ players }) => players)],
      teams: [...pool.teams, ...leaving.flatMap(({ teams }) => teams)],
    },
    rotations: {
      a: a === undefined ? match.rotations.a : a.rotation,
      b: b === undefined ? match.rotations.b : b.rotation,
    },
    teams: { a: a?.roster ?? match.teams.a, b: b?.roster ?? match.teams.b },
    winnerLeaving,
  };
}

/** Without a winner or with nobody waiting, nobody leaves, not even a winner past X (rule 1). */
function planAfter(
  state: CourtSessionState,
  match: FinishedMatch,
  input: NextMatchInput,
): NextMatchResult {
  if (match.winner === null || queueSize(state.queue) === 0) {
    return ok(assemblePlan(state, match, [], null));
  }
  const winnerLeaving = winnerLeavingOf(state, match.winner, input);
  const steps = runSteps(state, match, input, exitOrder(match.winner, winnerLeaving !== null));
  return steps.ok ? ok(assemblePlan(state, match, steps.value, winnerLeaving)) : steps;
}

/**
 * Proposes the next match after the last finished one: who leaves, who comes in and where, by the
 * mode of the group and the "vencedor também sai" (ADR 0029, ADR 0050). The plan is only a
 * calculation: the `MatchStarted` of the next match records it.
 */
export function planNextMatch(state: CourtSessionState, input: NextMatchInput): NextMatchResult {
  const refusal = refusalOf(state, input);
  const match = state.finishedMatches.at(-1);
  if (refusal !== null || match === undefined) {
    return err({ code: refusal ?? "no-finished-match" });
  }
  const planned = planAfter(state, match, input);
  if (!planned.ok) {
    return planned;
  }
  const { players, teams } = planned.value.queue;
  const queue = formTeams(teams, players, input.playersPerTeam);
  return queueSize(queue) > MAX_QUEUE_MEMBERS
    ? err({ code: "invalid-payload", field: "queue" })
    : ok({ ...planned.value, queue });
}
