// Payloads that change a team, the queue or a point during a match.
import { ok } from "@sacou/volley-rules";

import { isUuid } from "../../event-log/is-uuid.js";
import { AUTHORLESS_POINT_KINDS, POINT_KINDS } from "../constants.data.js";
import type {
  LineupChangedPayload,
  MemberId,
  PointAttributedPayload,
  PointKind,
  QueueChangedPayload,
} from "../types.js";
import {
  invalid,
  isOneOf,
  isSetterZone,
  isTeamSide,
  parseBenchMembers,
  parseLineupMembers,
  readOwn,
  type ParseResult,
  type RawObject,
} from "./payload-reading.js";
import { parseQueue } from "./queue-parsers.js";
import { parseLiberoFormat } from "./team-parsers.js";

/**
 * Format only: whether these are the members of the team is for the applier, which has `teams`, and
 * so is whether the system of the team plays with a libero.
 */
export function parseLineupChangedFields(raw: RawObject): ParseResult<LineupChangedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const team = readOwn(raw, "team");
  if (!isTeamSide(team)) return invalid("team");
  const lineup = parseLineupMembers(readOwn(raw, "lineup"));
  if (lineup === null) return invalid("lineup");
  const setterZone = readOwn(raw, "setterZone");
  if (!isSetterZone(setterZone)) return invalid("setterZone");
  const bench = parseBenchMembers(readOwn(raw, "bench"));
  if (bench === null || bench.some((id) => lineup.includes(id))) return invalid("bench");
  const libero = parseLiberoFormat(readOwn(raw, "libero"), lineup, bench);
  if (libero === undefined) return invalid("libero");
  return ok({ bench, libero, lineup, matchId, setterZone, team });
}

/** Format only: whether anyone waiting is on the court is for the applier, which has `teams`. */
export function parseQueueChangedFields(raw: RawObject): ParseResult<QueueChangedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const queue = parseQueue(readOwn(raw, "queue"));
  return queue.ok ? ok({ matchId, queue: queue.value }) : queue;
}

function isPointKind(value: unknown): value is PointKind {
  return isOneOf(POINT_KINDS, value);
}

/** An error of the opponent has no author, and every other kind has one. */
function isAuthorOfTheKind(kind: PointKind, author: MemberId | null): boolean {
  return AUTHORLESS_POINT_KINDS.includes(kind) === (author === null);
}

/**
 * Format only: whether the point exists and the author played it is for the applier and the
 * resolver. A missing `author` is invalid: the absence of an answer is no event (ADR 0031).
 */
export function parsePointAttributedFields(raw: RawObject): ParseResult<PointAttributedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const pointEventId = readOwn(raw, "pointEventId");
  if (!isUuid(pointEventId)) return invalid("pointEventId");
  const kind = readOwn(raw, "kind");
  if (!isPointKind(kind)) return invalid("kind");
  const author = readOwn(raw, "author");
  if (author !== null && !isUuid(author)) return invalid("author");
  if (!isAuthorOfTheKind(kind, author)) return invalid("author");
  return ok({ author, kind, matchId, pointEventId });
}
