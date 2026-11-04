import { ok } from "@sacou/volley-rules";

import type { EventApplier } from "../event-log/types.js";
import { findOpenMatch, findOpenSet, rejected, withCurrentMatch } from "./applier-lookups.js";
import {
  parseLineupChangedPayload,
  parsePointAttributedPayload,
  parseQueueChangedPayload,
  parseServingTeamChangedPayload,
} from "./parse-payloads.js";
import { isQueueOverlappingTeams } from "./queue-rules.js";
import { isLiberoAllowed, isRosterPartition } from "./rotation-rules.js";
import type { CourtSessionState, MatchTeams, MemberId } from "./types.js";

/**
 * Applies the recorded allocation. It checks the frozen `teams` and never the current lineup, so a
 * change that another writer interleaves with points is applied, and the last one in the order wins.
 * Whether the libero is on the court is never checked here: it is derived from the zone (ADR 0028).
 */
export const applyLineupChanged: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseLineupChangedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { bench, libero, lineup, matchId, setterZone, team } = parsed.value;
  const match = findOpenMatch(state, matchId);
  const teamState = match?.rotations[team] ?? null;
  if (match === null || teamState === null) {
    return rejected();
  }
  const { system } = teamState;
  if (
    !isRosterPartition(lineup, bench, libero, match.teams[team]) ||
    !isLiberoAllowed(system, libero)
  ) {
    return rejected();
  }
  return ok(
    withCurrentMatch(state, {
      ...match,
      rotations: { ...match.rotations, [team]: { bench, libero, lineup, setterZone, system } },
    }),
  );
};

/**
 * Replaces the whole queue, checked against the frozen `teams` of the open match: nobody waiting is
 * on the court. Like the `LineupChanged`, the last one in the canonical order wins (ADR 0029).
 */
export const applyQueueChanged: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseQueueChangedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { matchId, queue } = parsed.value;
  const match = findOpenMatch(state, matchId);
  if (match === null || isQueueOverlappingTeams(queue, match.teams)) {
    return rejected();
  }
  return ok({ currentMatch: match, finishedMatches: state.finishedMatches, queue });
};

/**
 * Records who serves and who served first in the open set, as the command decided: the score and
 * the current values are never checked, nobody rotates, and the last one in the order wins. It also
 * applies with the rotation off, because the serve is tracked anyway (ADR 0030).
 */
export const applyServingTeamChanged: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseServingTeamChangedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { firstServer, matchId, servingTeam, setNumber } = parsed.value;
  const match = findOpenMatch(state, matchId);
  const set = findOpenSet(match, setNumber);
  if (match === null || set === null) {
    return rejected();
  }
  return ok(
    withCurrentMatch(state, { ...match, currentSet: { ...set, firstServer, servingTeam } }),
  );
};

function isMatchMember({ a, b }: MatchTeams, memberId: MemberId): boolean {
  return a.memberIds.includes(memberId) || b.memberIds.includes(memberId);
}

/**
 * Changes nothing in the state, which therefore never grows with these events: who scored is read
 * from the timeline by `resolvePointAttributions`. It checks only that the match is open and that the
 * author plays in it, by the frozen `teams`, like the `LineupChanged`. Whether the target is an
 * active point is for the resolver, because the point and its attribution may come from two writers
 * in any order. Any set of the open match is accepted, the decided and the closed ones too (ADR 0031).
 */
export const applyPointAttributed: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parsePointAttributedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { author, matchId } = parsed.value;
  const match = findOpenMatch(state, matchId);
  if (match === null || (author !== null && !isMatchMember(match.teams, author))) {
    return rejected();
  }
  return ok(state);
};
