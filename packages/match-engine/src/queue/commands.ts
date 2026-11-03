import { err, ok } from "@sacou/volley-rules";

import { QUEUE_CHANGED_EVENT_TYPE } from "../score/constants.data.js";
import { parseQueueChangedPayload } from "../score/parse-payloads.js";
import { isQueueOverlappingTeams } from "../score/queue-rules.js";
import type {
  CourtQueue,
  MemberId,
  ScoreCommandResult,
  CourtSessionState,
  TeamRoster,
} from "../score/types.js";

function isSameMembers(first: readonly MemberId[], second: readonly MemberId[]): boolean {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

function isSameTeams(first: readonly TeamRoster[], second: readonly TeamRoster[]): boolean {
  return (
    first.length === second.length &&
    first.every((team, index) => isSameMembers(team.memberIds, second[index]?.memberIds ?? []))
  );
}

function isSameQueue(first: CourtQueue, second: CourtQueue): boolean {
  return isSameMembers(first.players, second.players) && isSameTeams(first.teams, second.teams);
}

/**
 * Records the whole queue during an open match, for whoever arrives or leaves: the order is the
 * caller's, and nobody waiting may be on the court (ADR 0029).
 */
export function changeQueue(state: CourtSessionState, queue: CourtQueue): ScoreCommandResult {
  const match = state.currentMatch;
  if (match === null) {
    return err({ code: "no-open-match" });
  }
  const parsed = parseQueueChangedPayload({ matchId: match.matchId, queue });
  if (!parsed.ok) {
    return parsed;
  }
  if (isQueueOverlappingTeams(parsed.value.queue, match.teams)) {
    return err({ code: "invalid-payload", field: "queue" });
  }
  return isSameQueue(state.queue, parsed.value.queue)
    ? err({ code: "queue-unchanged" })
    : ok([{ type: QUEUE_CHANGED_EVENT_TYPE, payload: parsed.value }]);
}
