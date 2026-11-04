import { ok } from "@sacou/volley-rules";

import { isUuid } from "../event-log/is-uuid.js";
import {
  AUTHORLESS_POINT_KINDS,
  BEST_OF_VALUES,
  END_REASONS,
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  PAYLOAD_ROOT_FIELD,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_KINDS,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SCORE_PAYLOAD_SHAPES,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  UNKNOWN_PAYLOAD_FIELD,
  WIN_MARGIN_VALUES,
} from "./constants.data.js";
import {
  parseBenchMembers,
  parseLiberoFormat,
  parseLineupMembers,
  parseMatchQueue,
  parseQueue,
  parseRotations,
  parseTeams,
} from "./parse-team-payloads.js";
import {
  hasUnknownKey,
  invalid,
  isOneOf,
  isPlainObject,
  isSetNumber,
  isSetPoints,
  isSetterZone,
  isTeamSide,
  isVersion,
  readOwn,
  type ParseResult,
  type PayloadParser,
  type RawObject,
} from "./payload-reading.js";
import type {
  LineupChangedPayload,
  MatchEndedPayload,
  MatchStartedPayload,
  MemberId,
  NextSet,
  PayloadShape,
  PointAttributedPayload,
  PointKind,
  PointScoredPayload,
  QueueChangedPayload,
  ScorePayload,
  ScoringRules,
  ServingTeamChangedPayload,
  SetEndedPayload,
  SetterZones,
} from "./types.js";

function parseScoring(raw: unknown): ParseResult<ScoringRules> {
  if (!isPlainObject(raw)) return invalid("scoring");
  const bestOf = readOwn(raw, "bestOf");
  if (!isOneOf(BEST_OF_VALUES, bestOf)) return invalid("scoring.bestOf");
  const pointsPerSet = readOwn(raw, "pointsPerSet");
  if (!isSetPoints(pointsPerSet)) return invalid("scoring.pointsPerSet");
  const tieBreakPoints = readOwn(raw, "tieBreakPoints");
  if (tieBreakPoints !== null && !isSetPoints(tieBreakPoints)) {
    return invalid("scoring.tieBreakPoints");
  }
  const winMargin = readOwn(raw, "winMargin");
  if (!isOneOf(WIN_MARGIN_VALUES, winMargin)) return invalid("scoring.winMargin");
  return ok({ bestOf, pointsPerSet, tieBreakPoints, winMargin });
}

function parseSetterZones(raw: unknown): ParseResult<SetterZones> {
  if (!isPlainObject(raw)) return invalid("nextSet.setterZones");
  const a = readOwn(raw, "a");
  if (a !== null && !isSetterZone(a)) return invalid("nextSet.setterZones.a");
  const b = readOwn(raw, "b");
  if (b !== null && !isSetterZone(b)) return invalid("nextSet.setterZones.b");
  return ok({ a, b });
}

function parseNextSet(raw: unknown): ParseResult<NextSet | null> {
  if (raw === null) return ok(null);
  if (!isPlainObject(raw)) return invalid("nextSet");
  const targetPoints = readOwn(raw, "targetPoints");
  if (!isSetPoints(targetPoints)) return invalid("nextSet.targetPoints");
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("nextSet.firstServer");
  const setterZones = parseSetterZones(readOwn(raw, "setterZones"));
  if (!setterZones.ok) return setterZones;
  return ok({ firstServer, setterZones: setterZones.value, targetPoints });
}

function parseMatchStartedFields(raw: RawObject): ParseResult<MatchStartedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const rulesVersion = readOwn(raw, "rulesVersion");
  if (!isVersion(rulesVersion)) return invalid("rulesVersion");
  const formationsVersion = readOwn(raw, "formationsVersion");
  if (!isVersion(formationsVersion)) return invalid("formationsVersion");
  const scoring = parseScoring(readOwn(raw, "scoring"));
  if (!scoring.ok) return scoring;
  const teams = parseTeams(readOwn(raw, "teams"));
  if (!teams.ok) return teams;
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("firstServer");
  const rotations = parseRotations(readOwn(raw, "rotations"), teams.value);
  if (!rotations.ok) return rotations;
  const queue = parseMatchQueue(readOwn(raw, "queue"), teams.value);
  if (!queue.ok) return queue;
  return ok({
    firstServer,
    formationsVersion,
    matchId,
    queue: queue.value,
    rotations: rotations.value,
    rulesVersion,
    scoring: scoring.value,
    teams: teams.value,
  });
}

interface SetReference {
  readonly matchId: string;
  readonly setNumber: number;
}

/** `matchId`, then `setNumber`: the first fields of the events about a set. */
function parseSetReference(raw: RawObject): ParseResult<SetReference> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const setNumber = readOwn(raw, "setNumber");
  if (!isSetNumber(setNumber)) return invalid("setNumber");
  return ok({ matchId, setNumber });
}

function parsePointScoredFields(raw: RawObject): ParseResult<PointScoredPayload> {
  const set = parseSetReference(raw);
  if (!set.ok) return set;
  const team = readOwn(raw, "team");
  if (!isTeamSide(team)) return invalid("team");
  const { matchId, setNumber } = set.value;
  return ok({ matchId, setNumber, team });
}

function parseSetEndedFields(raw: RawObject): ParseResult<SetEndedPayload> {
  const set = parseSetReference(raw);
  if (!set.ok) return set;
  const winner = readOwn(raw, "winner");
  if (!isTeamSide(winner)) return invalid("winner");
  const nextSet = parseNextSet(readOwn(raw, "nextSet"));
  if (!nextSet.ok) return nextSet;
  const { matchId, setNumber } = set.value;
  return ok({ matchId, nextSet: nextSet.value, setNumber, winner });
}

function parseMatchEndedFields(raw: RawObject): ParseResult<MatchEndedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const endReason = readOwn(raw, "endReason");
  if (!isOneOf(END_REASONS, endReason)) return invalid("endReason");
  const winner = readOwn(raw, "winner");
  if (winner !== null && !isTeamSide(winner)) return invalid("winner");
  if (endReason === "sets-won" && winner === null) return invalid("winner");
  return ok({ endReason, matchId, winner });
}

/**
 * Format only: whether these are the members of the team is for the applier, which has `teams`, and
 * so is whether the system of the team plays with a libero.
 */
function parseLineupChangedFields(raw: RawObject): ParseResult<LineupChangedPayload> {
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
function parseQueueChangedFields(raw: RawObject): ParseResult<QueueChangedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const queue = parseQueue(readOwn(raw, "queue"));
  return queue.ok ? ok({ matchId, queue: queue.value }) : queue;
}

/** Format only: whether the match and the set are open is for the applier, which has the state. */
function parseServingTeamChangedFields(raw: RawObject): ParseResult<ServingTeamChangedPayload> {
  const set = parseSetReference(raw);
  if (!set.ok) return set;
  const servingTeam = readOwn(raw, "servingTeam");
  if (!isTeamSide(servingTeam)) return invalid("servingTeam");
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("firstServer");
  const { matchId, setNumber } = set.value;
  return ok({ firstServer, matchId, servingTeam, setNumber });
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
function parsePointAttributedFields(raw: RawObject): ParseResult<PointAttributedPayload> {
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

/** Unknown keys are checked first, at every level; then the fields, in the order of the schema. */
function strictParser<T>(
  shape: PayloadShape,
  parseFields: (raw: RawObject) => ParseResult<T>,
): PayloadParser<T> {
  return (raw) => {
    try {
      if (!isPlainObject(raw)) {
        return invalid(PAYLOAD_ROOT_FIELD);
      }
      return hasUnknownKey(raw, shape) ? invalid(UNKNOWN_PAYLOAD_FIELD) : parseFields(raw);
    } catch {
      // Input that is not from JSON.parse can run code (getters, proxies).
      return invalid(PAYLOAD_ROOT_FIELD);
    }
  };
}

export const parseMatchStartedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[MATCH_STARTED_EVENT_TYPE],
  parseMatchStartedFields,
);

export const parsePointScoredPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[POINT_SCORED_EVENT_TYPE],
  parsePointScoredFields,
);

export const parseSetEndedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[SET_ENDED_EVENT_TYPE],
  parseSetEndedFields,
);

export const parseMatchEndedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[MATCH_ENDED_EVENT_TYPE],
  parseMatchEndedFields,
);

export const parseLineupChangedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[LINEUP_CHANGED_EVENT_TYPE],
  parseLineupChangedFields,
);

export const parseQueueChangedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[QUEUE_CHANGED_EVENT_TYPE],
  parseQueueChangedFields,
);

export const parseServingTeamChangedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[SERVING_TEAM_CHANGED_EVENT_TYPE],
  parseServingTeamChangedFields,
);

export const parsePointAttributedPayload = strictParser(
  SCORE_PAYLOAD_SHAPES[POINT_ATTRIBUTED_EVENT_TYPE],
  parsePointAttributedFields,
);

const PARSERS_BY_TYPE: ReadonlyMap<string, PayloadParser<ScorePayload>> = new Map<
  string,
  PayloadParser<ScorePayload>
>([
  [MATCH_STARTED_EVENT_TYPE, parseMatchStartedPayload],
  [POINT_SCORED_EVENT_TYPE, parsePointScoredPayload],
  [SET_ENDED_EVENT_TYPE, parseSetEndedPayload],
  [MATCH_ENDED_EVENT_TYPE, parseMatchEndedPayload],
  [LINEUP_CHANGED_EVENT_TYPE, parseLineupChangedPayload],
  [QUEUE_CHANGED_EVENT_TYPE, parseQueueChangedPayload],
  [SERVING_TEAM_CHANGED_EVENT_TYPE, parseServingTeamChangedPayload],
  [POINT_ATTRIBUTED_EVENT_TYPE, parsePointAttributedPayload],
]);

/** Fails closed: a type outside the score catalog has no valid payload here. */
export function parseScorePayload(type: string, payload: unknown): ParseResult<ScorePayload> {
  const parser = PARSERS_BY_TYPE.get(type);
  return parser === undefined ? invalid(PAYLOAD_ROOT_FIELD) : parser(payload);
}
