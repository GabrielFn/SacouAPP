import { err, ok, type Result } from "@sacou/volley-rules";

import type {
  CourtSessionState,
  MemberId,
  TeamQueue,
  TeamRoster,
  TeamSide,
  TeamState,
} from "../score/types.js";
import { getConsecutiveMatches } from "./consecutive-matches.js";
import { chooseOutgoing } from "./exit-criteria.js";
import type { PartialExit, PartialExitPlace, QueueExitChoice } from "./types.js";

/** One team leaving, by the mode of the group, against the queue that is left (ADR 0050). */
export interface ExitStepContext {
  readonly choice: QueueExitChoice;
  readonly pool: TeamQueue;
  readonly roster: TeamRoster;
  readonly rotation: TeamState | null;
  readonly side: TeamSide;
  readonly state: CourtSessionState;
}

/**
 * The side after the step: its team and rotation, whether a new team came in (`entered`, with the
 * rotation to set), the partial exits, who left (as teams or as singles) and the queue that is left.
 */
export interface ExitStepOutcome {
  readonly entered: boolean;
  readonly exits: readonly PartialExit[];
  readonly leaving: TeamQueue;
  readonly pool: TeamQueue;
  readonly roster: TeamRoster;
  readonly rotation: TeamState | null;
}

export type ExitStepResult = Result<ExitStepOutcome, { readonly code: "invalid-exit-choice" }>;

const NO_ONE: TeamQueue = { players: [], teams: [] };

/** Nobody waits for this side: nothing changes (rule 1 of `fila.md`). */
export function stayStep({ pool, roster, rotation }: ExitStepContext): ExitStepOutcome {
  return { entered: false, exits: [], leaving: NO_ONE, pool, roster, rotation };
}

/** The first team of the queue takes the side, with its rotation off for E4.7. */
export function enterFirstTeam(
  { pool, roster }: ExitStepContext,
  leaving: (left: TeamRoster) => TeamQueue,
): ExitStepOutcome {
  const [entering, ...waiting] = pool.teams as readonly [TeamRoster, ...TeamRoster[]];
  return {
    entered: true,
    exits: [],
    leaving: leaving(roster),
    pool: { players: pool.players, teams: waiting },
    roster: entering,
    rotation: null,
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

/** Whether the rotation goes on with the ones who come in, or the lineup is set again. */
export type RotationAfterExit = "kept" | "reset";

/**
 * The first `incoming` of the queue replace as many of the team, chosen by the criterion. The pairs
 * follow the order of the team, never the order of the criterion, and whoever leaves goes to the end
 * of the queue in that order. `rest` is the queue without the ones who came in.
 */
export function replaceMembers(
  context: ExitStepContext,
  incoming: readonly MemberId[],
  rest: TeamQueue,
  rotationAfter: RotationAfterExit,
): ExitStepResult {
  const { choice, roster, side, state } = context;
  const { memberIds } = roster;
  const chosen = chooseOutgoing(choice, { count: incoming.length, memberIds, state });
  if (chosen === null) {
    return err({ code: "invalid-exit-choice" });
  }
  const outgoing = memberIds.filter((id) => chosen.includes(id));
  const incomingFor = (id: MemberId) => incoming[outgoing.indexOf(id)] ?? id;
  const kept = rotationAfter === "kept" ? context.rotation : null;
  const exits: readonly PartialExit[] = outgoing.map((id, index) => ({
    consecutiveMatches: getConsecutiveMatches(state, id),
    incoming: incoming[index] as MemberId,
    outgoing: id,
    place: placeOf(id, memberIds, kept),
    side,
  }));
  return ok({
    entered: rotationAfter === "reset",
    exits,
    leaving: { players: outgoing, teams: [] },
    pool: rest,
    roster: { memberIds: memberIds.map(incomingFor) },
    rotation: kept === null ? null : replaceInTeamState(kept, incomingFor),
  });
}

/** As many singles as wait come in, up to the whole team (rule 3 of `fila.md`). */
export function replaceBySingles(
  context: ExitStepContext,
  rotationAfter: RotationAfterExit,
): ExitStepResult {
  const { players, teams } = context.pool;
  const count = Math.min(players.length, context.roster.memberIds.length);
  return replaceMembers(
    context,
    players.slice(0, count),
    { players: players.slice(count), teams },
    rotationAfter,
  );
}
