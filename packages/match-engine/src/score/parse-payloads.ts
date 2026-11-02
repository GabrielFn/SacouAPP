import { err, ok, ROTATION_SLOTS, type Result, type SetterZone } from "@sacou/volley-rules";

import { isUuid } from "../event-log/is-uuid.js";
import {
  BEST_OF_VALUES,
  END_REASONS,
  FIRST_SET_NUMBER,
  LAST_SET_NUMBER,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_SET_POINTS,
  MAX_TEAM_MEMBERS,
  MIN_SET_POINTS,
  MIN_TEAM_MEMBERS,
  PAYLOAD_ROOT_FIELD,
  POINT_SCORED_EVENT_TYPE,
  SCORE_PAYLOAD_SHAPES,
  SET_ENDED_EVENT_TYPE,
  SETTER_ZONE_SEQUENCE,
  TEAM_SIDES,
  UNKNOWN_PAYLOAD_FIELD,
  WIN_MARGIN_VALUES,
} from "./constants.data.js";
import type {
  MatchEndedPayload,
  MatchStartedPayload,
  MatchTeams,
  MemberId,
  NextSet,
  PayloadShape,
  PointScoredPayload,
  ScorePayload,
  ScorePayloadError,
  ScorePayloadField,
  ScoringRules,
  SetEndedPayload,
  SetterZones,
  TeamRoster,
  TeamRotations,
  TeamSide,
  TeamState,
} from "./types.js";

type RawObject = Readonly<Record<string, unknown>>;
type ParseResult<T> = Result<T, ScorePayloadError>;
type PayloadParser<T> = (raw: unknown) => ParseResult<T>;

function invalid(field: ScorePayloadField): Result<never, ScorePayloadError> {
  return err({ code: "invalid-payload", field });
}

function isPlainObject(value: unknown): value is RawObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isOneOf<T>(allowed: readonly T[], value: unknown): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

function isSetPoints(value: unknown): value is number {
  return isIntegerInRange(value, MIN_SET_POINTS, MAX_SET_POINTS);
}

function isSetNumber(value: unknown): value is number {
  return isIntegerInRange(value, FIRST_SET_NUMBER, LAST_SET_NUMBER);
}

function isTeamSide(value: unknown): value is TeamSide {
  return isOneOf(TEAM_SIDES, value);
}

function isSetterZone(value: unknown): value is SetterZone {
  return isOneOf(SETTER_ZONE_SEQUENCE, value);
}

/** Own properties only: with a polluted Object.prototype, a missing field must stay missing. */
function readOwn(raw: RawObject, field: string): unknown {
  return Object.hasOwn(raw, field) ? raw[field] : undefined;
}

function hasUnknownKey(raw: RawObject, shape: PayloadShape): boolean {
  return Reflect.ownKeys(raw).some((key) => {
    if (typeof key !== "string" || !Object.hasOwn(shape, key)) {
      return true;
    }
    const childShape = shape[key] ?? null;
    const child = raw[key];
    // A child of the wrong type has no keys to report: its own field check rejects it.
    return childShape !== null && isPlainObject(child) && hasUnknownKey(child, childShape);
  });
}

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

/** The copy turns holes of a sparse array into undefined, which fails the UUID check. */
function parseUniqueMemberIds(raw: unknown, min: number, max: number): readonly MemberId[] | null {
  if (!Array.isArray(raw) || !isIntegerInRange(raw.length, min, max)) {
    return null;
  }
  const items: readonly unknown[] = Array.from(raw as readonly unknown[]);
  const memberIds = items.filter(isUuid);
  const isValid = memberIds.length === items.length && new Set(memberIds).size === items.length;
  return isValid ? memberIds : null;
}

function parseMemberIds(raw: unknown): readonly MemberId[] | null {
  return parseUniqueMemberIds(raw, MIN_TEAM_MEMBERS, MAX_TEAM_MEMBERS);
}

function parseRoster(
  raw: unknown,
  rosterField: ScorePayloadField,
  memberIdsField: ScorePayloadField,
): ParseResult<TeamRoster> {
  if (!isPlainObject(raw)) return invalid(rosterField);
  const memberIds = parseMemberIds(readOwn(raw, "memberIds"));
  return memberIds === null ? invalid(memberIdsField) : ok({ memberIds });
}

function parseTeams(raw: unknown): ParseResult<MatchTeams> {
  if (!isPlainObject(raw)) return invalid("teams");
  const a = parseRoster(readOwn(raw, "a"), "teams.a", "teams.a.memberIds");
  if (!a.ok) return a;
  const b = parseRoster(readOwn(raw, "b"), "teams.b", "teams.b.memberIds");
  if (!b.ok) return b;
  const hasSharedMember = b.value.memberIds.some((id) => a.value.memberIds.includes(id));
  return hasSharedMember ? invalid("teams.b.memberIds") : ok({ a: a.value, b: b.value });
}

/** Exactly one player per position, and all of them from the team of the frozen copy. */
function parseLineup(raw: unknown, { memberIds }: TeamRoster): readonly MemberId[] | null {
  const lineup = parseUniqueMemberIds(raw, ROTATION_SLOTS.length, ROTATION_SLOTS.length);
  return lineup?.every((id) => memberIds.includes(id)) === true ? lineup : null;
}

function parseTeamState(
  raw: unknown,
  roster: TeamRoster,
  fields: {
    readonly team: ScorePayloadField;
    readonly lineup: ScorePayloadField;
    readonly setterZone: ScorePayloadField;
  },
): ParseResult<TeamState | null> {
  if (raw === null) return ok(null);
  if (!isPlainObject(raw)) return invalid(fields.team);
  const lineup = parseLineup(readOwn(raw, "lineup"), roster);
  if (lineup === null) return invalid(fields.lineup);
  const setterZone = readOwn(raw, "setterZone");
  return isSetterZone(setterZone) ? ok({ lineup, setterZone }) : invalid(fields.setterZone);
}

function parseRotations(raw: unknown, teams: MatchTeams): ParseResult<TeamRotations> {
  if (!isPlainObject(raw)) return invalid("rotations");
  const a = parseTeamState(readOwn(raw, "a"), teams.a, {
    team: "rotations.a",
    lineup: "rotations.a.lineup",
    setterZone: "rotations.a.setterZone",
  });
  if (!a.ok) return a;
  const b = parseTeamState(readOwn(raw, "b"), teams.b, {
    team: "rotations.b",
    lineup: "rotations.b.lineup",
    setterZone: "rotations.b.setterZone",
  });
  return b.ok ? ok({ a: a.value, b: b.value }) : b;
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
  if (!isIntegerInRange(rulesVersion, 1, Number.MAX_SAFE_INTEGER)) return invalid("rulesVersion");
  const scoring = parseScoring(readOwn(raw, "scoring"));
  if (!scoring.ok) return scoring;
  const teams = parseTeams(readOwn(raw, "teams"));
  if (!teams.ok) return teams;
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("firstServer");
  const rotations = parseRotations(readOwn(raw, "rotations"), teams.value);
  if (!rotations.ok) return rotations;
  return ok({
    firstServer,
    matchId,
    rotations: rotations.value,
    rulesVersion,
    scoring: scoring.value,
    teams: teams.value,
  });
}

function parsePointScoredFields(raw: RawObject): ParseResult<PointScoredPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const setNumber = readOwn(raw, "setNumber");
  if (!isSetNumber(setNumber)) return invalid("setNumber");
  const team = readOwn(raw, "team");
  if (!isTeamSide(team)) return invalid("team");
  return ok({ matchId, setNumber, team });
}

function parseSetEndedFields(raw: RawObject): ParseResult<SetEndedPayload> {
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const setNumber = readOwn(raw, "setNumber");
  if (!isSetNumber(setNumber)) return invalid("setNumber");
  const winner = readOwn(raw, "winner");
  if (!isTeamSide(winner)) return invalid("winner");
  const nextSet = parseNextSet(readOwn(raw, "nextSet"));
  if (!nextSet.ok) return nextSet;
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

const PARSERS_BY_TYPE: ReadonlyMap<string, PayloadParser<ScorePayload>> = new Map<
  string,
  PayloadParser<ScorePayload>
>([
  [MATCH_STARTED_EVENT_TYPE, parseMatchStartedPayload],
  [POINT_SCORED_EVENT_TYPE, parsePointScoredPayload],
  [SET_ENDED_EVENT_TYPE, parseSetEndedPayload],
  [MATCH_ENDED_EVENT_TYPE, parseMatchEndedPayload],
]);

/** Fails closed: a type outside the score catalog has no valid payload here. */
export function parseScorePayload(type: string, payload: unknown): ParseResult<ScorePayload> {
  const parser = PARSERS_BY_TYPE.get(type);
  return parser === undefined ? invalid(PAYLOAD_ROOT_FIELD) : parser(payload);
}
