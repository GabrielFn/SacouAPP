import { err, ok, type Result } from "@sacou/volley-rules";

import { getOpenMatch, getOpenMatchStartIndex } from "../corrections/timeline.js";
import type { CourtSessionTimeline } from "../corrections/types.js";
import {
  AUTHORLESS_POINT_KINDS,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_KINDS,
  POINT_SCORED_EVENT_TYPE,
} from "../score/constants.data.js";
import { parsePointScoredPayload, parseScorePayload } from "../score/parse-payloads.js";
import { getOnCourtBySlot } from "../score/rotation-rules.js";
import type { MemberId, PointKind } from "../score/types.js";
import { isPlausibleAuthor } from "./plausibility.js";
import type {
  AttributionCommandResult,
  AttributionError,
  AttributionRefusalCode,
  PointAuthorship,
  Rally,
} from "./types.js";

function refuse(code: AttributionRefusalCode): Result<never, AttributionError> {
  return err({ code });
}

/**
 * The rally of an active point of the open match, from the state right before it. Any set of the
 * open match counts, the decided and the closed ones too; a point of an earlier match does not.
 */
function findRally(
  timeline: CourtSessionTimeline,
  matchId: string,
  pointEventId: string,
): Rally | null {
  const { entries } = timeline;
  const index = entries.findIndex(({ event }) => event.eventId === pointEventId);
  const entry = entries[index];
  const before = entries[index - 1]?.state.currentMatch ?? null;
  if (entry === undefined || index <= getOpenMatchStartIndex(timeline) || before === null) {
    return null;
  }
  const { event } = entry;
  const parsed =
    event.type === POINT_SCORED_EVENT_TYPE ? parsePointScoredPayload(event.payload) : null;
  const set = before.currentSet;
  if (parsed?.ok !== true || parsed.value.matchId !== matchId || set === null) {
    return null;
  }
  return { match: before, team: parsed.value.team, servingTeam: set.servingTeam };
}

/**
 * Who stood on the court for the team that scored, in the rally: the libero included when it was
 * in, the bench never. With the rotation of that team off, anyone of the team.
 */
function onCourtInTheRally({ match, servingTeam, team }: Rally): readonly MemberId[] {
  const teamState = match.rotations[team];
  if (teamState === null) {
    return match.teams[team].memberIds;
  }
  return getOnCourtBySlot(teamState, servingTeam === team ? "serving" : "receiving");
}

function isPointKind(kind: unknown): kind is PointKind {
  return (POINT_KINDS as readonly unknown[]).includes(kind);
}

function isValidAuthor(rally: Rally, kind: PointKind, author: MemberId | null): boolean {
  if (AUTHORLESS_POINT_KINDS.includes(kind) !== (author === null)) {
    return false;
  }
  return (
    author === null ||
    (onCourtInTheRally(rally).includes(author) && isPlausibleAuthor(rally, kind, author))
  );
}

/**
 * "De quem foi?" on screen 31, at once or later from Corrigir or the end of the set: records who
 * scored a point of the open match and how. Answering again records a new event, and the last one
 * wins; "Pular" records nothing. The author is checked against the court of the rally, never the
 * current one (ADR 0031).
 */
export function attributePoint(
  timeline: CourtSessionTimeline,
  pointEventId: string,
  { kind, author }: PointAuthorship,
): AttributionCommandResult {
  const match = getOpenMatch(timeline);
  if (match === null) {
    return refuse("no-open-match");
  }
  const rally = findRally(timeline, match.matchId, pointEventId);
  if (rally === null) {
    return refuse("invalid-attribution-target");
  }
  if (!isPointKind(kind)) {
    return refuse("invalid-point-kind");
  }
  if (!isValidAuthor(rally, kind, author)) {
    return refuse("invalid-point-author");
  }
  const payload = { author, kind, matchId: match.matchId, pointEventId };
  const parsed = parseScorePayload(POINT_ATTRIBUTED_EVENT_TYPE, payload);
  return parsed.ok ? ok([{ type: POINT_ATTRIBUTED_EVENT_TYPE, payload: parsed.value }]) : parsed;
}
