import { err, ok } from "@sacou/volley-rules";

import { MAX_QUEUE_MEMBERS, MAX_TEAM_MEMBERS, TEAM_SIDES } from "../score/constants.data.js";
import { queueSize } from "../score/queue-rules.js";
import type {
  TeamQueue,
  CourtSessionState,
  FinishedMatch,
  MatchTeams,
  MemberId,
  TeamRoster,
  TeamSide,
  TeamState,
} from "../score/types.js";
import { getConsecutiveMatches } from "./consecutive-matches.js";
import { MIN_PLAYERS_PER_TEAM } from "./constants.data.js";
import { chooseOutgoing } from "./exit-criteria.js";
import type {
  NextMatchInput,
  NextMatchPlan,
  NextMatchResult,
  PartialExit,
  PartialExitPlace,
  QueueRefusalCode,
} from "./types.js";

function refuse(code: QueueRefusalCode): NextMatchResult {
  return err({ code });
}

function otherSide(side: TeamSide): TeamSide {
  return side === TEAM_SIDES[0] ? TEAM_SIDES[1] : TEAM_SIDES[0];
}

function isPlayersPerTeam(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= MIN_PLAYERS_PER_TEAM &&
    value <= MAX_TEAM_MEMBERS
  );
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

/** The match as it ended: the winner, and the rotation where it stopped (ADR 0029). */
function unchangedPlan(match: FinishedMatch, queue: TeamQueue): NextMatchPlan {
  return { enteringTeam: null, exits: [], queue, rotations: match.rotations, teams: match.teams };
}

function withSide<T>(pair: Readonly<Record<TeamSide, T>>, side: TeamSide, value: T) {
  return side === TEAM_SIDES[0] ? { a: value, b: pair.b } : { a: pair.a, b: value };
}

/** The first team of the queue takes the side of the loser, with its rotation off for E4.7. */
function planWholeTeam(
  match: FinishedMatch,
  loser: TeamSide,
  { players, teams }: TeamQueue,
): NextMatchPlan {
  const [entering, ...waiting] = teams as readonly [TeamRoster, ...TeamRoster[]];
  return {
    enteringTeam: loser,
    exits: [],
    queue: { players: [...players, ...match.teams[loser].memberIds], teams: waiting },
    rotations: withSide(match.rotations, loser, null),
    teams: withSide(match.teams, loser, entering),
  };
}

function placeOf(
  memberId: MemberId,
  memberIds: readonly MemberId[],
  teamState: TeamState | null,
): PartialExitPlace {
  if (teamState === null) {
    return { area: "team", index: memberIds.indexOf(memberId) };
  }
  if (teamState.lineup.includes(memberId)) {
    return { area: "lineup", index: teamState.lineup.indexOf(memberId) };
  }
  return teamState.libero?.memberId === memberId
    ? { area: "libero" }
    : { area: "bench", index: teamState.bench.indexOf(memberId) };
}

/**
 * Whoever comes in takes the place of whoever leaves. In the place of the libero, the one who comes
 * in goes to the end of the bench, and the team has no libero (decision of the product owner).
 */
function replaceInTeamState(
  teamState: TeamState,
  incomingFor: (memberId: MemberId) => MemberId,
): TeamState {
  const { bench, libero, lineup } = teamState;
  const replaced = { ...teamState, bench: bench.map(incomingFor), lineup: lineup.map(incomingFor) };
  const liberoIncoming = libero === null ? null : incomingFor(libero.memberId);
  return liberoIncoming === null || liberoIncoming === libero?.memberId
    ? replaced
    : { ...replaced, bench: [...replaced.bench, liberoIncoming], libero: null };
}

/**
 * Only single players wait: as many leave as wait, up to the whole team, by the criterion. The pairs
 * follow the order of the team, never the order of the criterion, and whoever leaves goes to the end
 * of the queue in that order.
 */
function planPartialExit(
  state: CourtSessionState,
  match: FinishedMatch,
  loser: TeamSide,
  input: NextMatchInput,
): NextMatchResult {
  const { players } = state.queue;
  const { memberIds } = match.teams[loser];
  const count = Math.min(players.length, memberIds.length);
  const chosen = chooseOutgoing(input, { count, memberIds, state });
  if (chosen === null) {
    return refuse("invalid-exit-choice");
  }
  const outgoing = memberIds.filter((id) => chosen.includes(id));
  const incoming = players.slice(0, count);
  const incomingFor = (id: MemberId) => incoming[outgoing.indexOf(id)] ?? id;
  const teamState = match.rotations[loser];
  const exits: readonly PartialExit[] = outgoing.map((id, index) => ({
    consecutiveMatches: getConsecutiveMatches(state, id),
    incoming: incoming[index] as MemberId,
    outgoing: id,
    place: placeOf(id, memberIds, teamState),
  }));
  const teams: MatchTeams = withSide(match.teams, loser, { memberIds: memberIds.map(incomingFor) });
  return ok({
    enteringTeam: null,
    exits,
    queue: { players: [...players.slice(count), ...outgoing], teams: [] },
    rotations: withSide(
      match.rotations,
      loser,
      teamState === null ? null : replaceInTeamState(teamState, incomingFor),
    ),
    teams,
  });
}

function planAfter(
  state: CourtSessionState,
  match: FinishedMatch,
  input: NextMatchInput,
): NextMatchResult {
  const { queue } = state;
  if (match.winner === null || queueSize(queue) === 0) {
    return ok(unchangedPlan(match, queue));
  }
  const loser = otherSide(match.winner);
  return queue.teams.length > 0
    ? ok(planWholeTeam(match, loser, queue))
    : planPartialExit(state, match, loser, input);
}

/**
 * Proposes the next match after the last finished one: who leaves, who comes in and where. Only the
 * automatic mode of the MVP: a whole team when one waits, a partial exit when not, and nobody leaves
 * when nobody waits or the match had no winner (ADR 0029). The plan is only a calculation: the
 * `MatchStarted` of the next match records it.
 */
export function planNextMatch(state: CourtSessionState, input: NextMatchInput): NextMatchResult {
  if (state.currentMatch !== null) {
    return refuse("match-already-open");
  }
  const match = state.finishedMatches.at(-1);
  if (match === undefined) {
    return refuse("no-finished-match");
  }
  if (!isPlayersPerTeam(input.playersPerTeam)) {
    return refuse("invalid-players-per-team");
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
