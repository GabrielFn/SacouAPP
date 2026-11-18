import {
  LINEUP_CHANGED_EVENT_TYPE,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  parseLineupChangedPayload,
  parsePointScoredPayload,
  type CourtSessionTimeline,
  type SetScore,
  type TeamSide,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";

/** What the last action was, before DESFAZER takes it back (ADR 0030, E4.10 D12). */
export type UndoNotice =
  | { readonly kind: "point"; readonly team: TeamSide; readonly score: SetScore }
  | { readonly kind: "serving-change" }
  /** A change of lineup: `girar`, or a substitution. */
  | { readonly kind: "rotation"; readonly team: TeamSide }
  | { readonly kind: "queue" }
  | { readonly kind: "set-end" }
  | { readonly kind: "attribution" };

type LastEntry = NonNullable<CourtSessionTimeline["entries"][number]>;

function pointNotice({ event, state }: LastEntry): UndoNotice | null {
  const parsed = parsePointScoredPayload(event.payload);
  const score = state.currentMatch?.currentSet?.score;
  return !parsed.ok || score === undefined
    ? null
    : { kind: "point", team: parsed.value.team, score };
}

function rotationNotice({ event }: LastEntry): UndoNotice | null {
  const parsed = parseLineupChangedPayload(event.payload);
  return parsed.ok ? { kind: "rotation", team: parsed.value.team } : null;
}

/**
 * Describes the action DESFAZER is about to undo: the last active event. `null` when there is
 * nothing to describe. Reads the timeline before the command is sent.
 */
export function describeUndo(timeline: CourtSessionTimeline): UndoNotice | null {
  const last = timeline.entries.at(-1);
  if (last === undefined) {
    return null;
  }
  switch (last.event.type) {
    case POINT_SCORED_EVENT_TYPE:
      return pointNotice(last);
    case SERVING_TEAM_CHANGED_EVENT_TYPE:
      return { kind: "serving-change" };
    case LINEUP_CHANGED_EVENT_TYPE:
      return rotationNotice(last);
    case QUEUE_CHANGED_EVENT_TYPE:
      return { kind: "queue" };
    case SET_ENDED_EVENT_TYPE:
      return { kind: "set-end" };
    case POINT_ATTRIBUTED_EVENT_TYPE:
      return { kind: "attribution" };
    default:
      return null;
  }
}

/** The line of the middle strip for a notice; `teamLabel` names a side ("Laranja"). */
export function undoNoticeText(
  notice: UndoNotice,
  teamLabel: (side: TeamSide) => string,
): string {
  const { undoNotice } = strings.court;
  switch (notice.kind) {
    case "point":
      return undoNotice.point(teamLabel(notice.team), notice.score.a, notice.score.b);
    case "rotation":
      return undoNotice.rotation(teamLabel(notice.team));
    case "serving-change":
      return undoNotice.servingChange;
    case "queue":
      return undoNotice.queue;
    case "set-end":
      return undoNotice.setEnd;
    case "attribution":
      return undoNotice.attribution;
  }
}
