import { err, ok, type Result } from "@sacou/volley-rules";

import { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import { getOpenMatch, getOpenMatchStartIndex } from "./timeline.js";
import type {
  CorrectionCommandResult,
  CorrectionError,
  CorrectionRefusalCode,
  CourtSessionTimeline,
} from "./types.js";

function refuse(code: CorrectionRefusalCode): Result<never, CorrectionError> {
  return err({ code });
}

/**
 * Where a revert to `eventId` lands, by index of the timeline: an active event of the open match
 * that is not the last one. Going back past the start of the open match is not a correction.
 */
export function findRevertTargetIndex(
  timeline: CourtSessionTimeline,
  eventId: string,
): Result<number, CorrectionError> {
  if (getOpenMatch(timeline) === null) {
    return refuse("no-open-match");
  }
  const { entries } = timeline;
  const index = entries.findIndex(({ event }) => event.eventId === eventId);
  if (index < 0) {
    return refuse("invalid-revert-target");
  }
  if (index === entries.length - 1) {
    return refuse("nothing-to-undo");
  }
  return index < getOpenMatchStartIndex(timeline) ? refuse("invalid-revert-target") : ok(index);
}

function revertTo(timeline: CourtSessionTimeline, index: number): CorrectionCommandResult {
  const target = timeline.entries[index];
  return target === undefined
    ? refuse("invalid-revert-target")
    : ok([{ type: REVERTED_TO_EVENT_TYPE, payload: { targetEventId: target.event.eventId } }]);
}

/**
 * "Voltar até aqui" on screen 24: a `RevertedTo` to the event, after which the state is the one
 * right after it. Score, serve, rotations, bench, libero and queue go back together (ADR 0030).
 */
export function revertToEvent(
  timeline: CourtSessionTimeline,
  eventId: string,
): CorrectionCommandResult {
  const index = findRevertTargetIndex(timeline, eventId);
  return index.ok ? revertTo(timeline, index.value) : index;
}

/**
 * DESFAZER undoes the last action, whatever it is: a point, a change of lineup or queue, girar, a
 * switch of the serve, or the end of a set. Right after the `MatchStarted` there is nothing to undo.
 */
export function undoLastAction(timeline: CourtSessionTimeline): CorrectionCommandResult {
  if (getOpenMatch(timeline) === null) {
    return refuse("no-open-match");
  }
  const lastIndex = timeline.entries.length - 1;
  return lastIndex <= getOpenMatchStartIndex(timeline)
    ? refuse("nothing-to-undo")
    : revertTo(timeline, lastIndex - 1);
}
