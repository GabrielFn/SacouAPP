import {
  POINT_SCORED_EVENT_TYPE,
  REVERTED_TO_EVENT_TYPE,
  refusedPoints,
  type CourtSessionTimeline,
  type EventEnvelope,
  type TeamSide,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { StoredCourtLog } from "../ports/court-event-log";
import type { CourtReplayer } from "../session/court-replay";

export interface RefusedRow {
  readonly eventId: string;
  /** "Ponto do Laranja": team A is orange and B blue, as on the court (E4.7). */
  readonly text: string;
  /** The score right after the point on this phone, or `null` when no set was open after it. */
  readonly scoreText: string | null;
}

/** What screen 09c lists (D6), derived from the log and the refused events, never stored. */
export interface RefusedPointsModel {
  readonly rows: readonly RefusedRow[];
  /** A "Desfazer" of this phone did not reach the server: the point it undid still counts there. */
  readonly undoLeftOut: boolean;
  /** Nothing of this stream is on this phone: another phone already wrote the court of the round. */
  readonly otherPhoneFirst: boolean;
}

export type RefusedInput = Pick<StoredCourtLog, "events" | "refused" | "ackedSequence">;

const TEAM_LABELS: Readonly<Record<TeamSide, string>> = {
  a: strings.court.roster.orange,
  b: strings.court.roster.blue,
};

function scoreAfter(timeline: CourtSessionTimeline, eventId: string): string | null {
  const entry = timeline.entries.find(({ event }) => event.eventId === eventId);
  const score = entry?.state.currentMatch?.currentSet?.score ?? null;
  return score === null ? null : strings.court.refused.score(score.a, score.b);
}

function targetOf(event: EventEnvelope): unknown {
  return event.payload["targetEventId"];
}

/** A refused undo whose target the server holds: the server still counts what it undid here. */
function hasUndoLeftOut(input: RefusedInput): boolean {
  const kept = new Set(input.events.map((event) => event.eventId));
  return input.refused.some((event) => {
    const target = targetOf(event);
    return event.type === REVERTED_TO_EVENT_TYPE && typeof target === "string" && kept.has(target);
  });
}

/** Without a replay, the refused points are still counted, only without the score. */
function rowsWithoutReplay(refused: readonly EventEnvelope[]): readonly RefusedRow[] {
  return refused.flatMap((event) => {
    const team = event.payload["team"];
    if (event.type !== POINT_SCORED_EVENT_TYPE || (team !== "a" && team !== "b")) return [];
    return [
      {
        eventId: event.eventId,
        text: strings.court.refused.point(TEAM_LABELS[team]),
        scoreText: null,
      },
    ];
  });
}

/**
 * The refused points of this phone (`refusedPoints`, ADR 0063, D11) over the log as it was before the
 * take-over: what the server kept, then what it refused, in that order.
 */
export function refusedPointsModel(
  courtSessionId: string,
  deviceId: string,
  input: RefusedInput,
  replayer: CourtReplayer,
): RefusedPointsModel {
  const before = [...input.events, ...input.refused];
  const replayed = replayer.replay(courtSessionId, before);
  const rows = replayed.ok
    ? refusedPoints(replayed.value, { deviceId, lastStoredSequence: input.ackedSequence }).map(
        (point) => ({
          eventId: point.eventId,
          text: strings.court.refused.point(TEAM_LABELS[point.team]),
          scoreText: scoreAfter(replayed.value, point.eventId),
        }),
      )
    : rowsWithoutReplay(input.refused);
  return {
    rows,
    undoLeftOut: hasUndoLeftOut(input),
    otherPhoneFirst: input.events.length === 0,
  };
}

/** Screen 09c shows while it has something to say and was not closed with "Entendi" (D6). */
export function showsRefused(model: RefusedPointsModel, unseen: boolean): boolean {
  return unseen && (model.rows.length > 0 || model.undoLeftOut);
}
