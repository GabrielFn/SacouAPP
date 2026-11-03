import {
  err,
  FORMATION_SYSTEMS,
  ok,
  ROTATION_SLOTS,
  type FormationSystem,
  type Result,
  type SetterZone,
} from "@sacou/volley-rules";

import { isUuid } from "../event-log/is-uuid.js";
import {
  BEST_OF_VALUES,
  END_REASONS,
  FIRST_SET_NUMBER,
  LAST_SET_NUMBER,
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_BENCH_MEMBERS,
  MAX_LIBERO_REPLACED_INDEXES,
  MAX_QUEUE_MEMBERS,
  MAX_SET_POINTS,
  MAX_TEAM_MEMBERS,
  MIN_BENCH_MEMBERS,
  MIN_SET_POINTS,
  MIN_TEAM_MEMBERS,
  PAYLOAD_ROOT_FIELD,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SCORE_PAYLOAD_SHAPES,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  SETTER_ZONE_SEQUENCE,
  TEAM_SIDES,
  UNKNOWN_PAYLOAD_FIELD,
  WIN_MARGIN_VALUES,
} from "./constants.data.js";
import { isQueueOverlappingTeams, queueSize } from "./queue-rules.js";
import { isLiberoAllowed, isLiberoCoverage, isRosterPartition } from "./rotation-rules.js";
import type {
  TeamQueue,
  LineupChangedPayload,
  MatchEndedPayload,
  MatchStartedPayload,
  MatchTeams,
  MemberId,
  NextSet,
  PayloadShape,
  PointScoredPayload,
  QueueChangedPayload,
  ScorePayload,
  ScorePayloadError,
  ScorePayloadField,
  ScoringRules,
  ServingTeamChangedPayload,
  SetEndedPayload,
  SetterZones,
  TeamLibero,
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

function isFormationSystem(value: unknown): value is FormationSystem {
  return isOneOf(FORMATION_SYSTEMS, value);
}

function isVersion(value: unknown): value is number {
  return isIntegerInRange(value, 1, Number.MAX_SAFE_INTEGER);
}

/** Own properties only: with a polluted Object.prototype, a missing field must stay missing. */
function readOwn(raw: RawObject, field: string): unknown {
  return Object.hasOwn(raw, field) ? raw[field] : undefined;
}

type ChildShape = PayloadShape[string];

/** A child of the wrong type has no keys to report: its own field check rejects it. */
function hasUnknownChildKey(child: unknown, childShape: ChildShape | undefined): boolean {
  if (childShape === null || childShape === undefined) {
    return false;
  }
  if (isPayloadListShape(childShape)) {
    const [itemShape] = childShape;
    return (
      Array.isArray(child) &&
      (child as readonly unknown[]).some(
        (item) => isPlainObject(item) && hasUnknownKey(item, itemShape),
      )
    );
  }
  return isPlainObject(child) && hasUnknownKey(child, childShape);
}

function isPayloadListShape(
  shape: PayloadShape | readonly [PayloadShape],
): shape is readonly [PayloadShape] {
  return Array.isArray(shape);
}

function hasUnknownKey(raw: RawObject, shape: PayloadShape): boolean {
  return Reflect.ownKeys(raw).some(
    (key) =>
      typeof key !== "string" ||
      !Object.hasOwn(shape, key) ||
      hasUnknownChildKey(raw[key], shape[key]),
  );
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

function parseLineupMembers(raw: unknown): readonly MemberId[] | null {
  return parseUniqueMemberIds(raw, ROTATION_SLOTS.length, ROTATION_SLOTS.length);
}

/** Exactly one player per position, and all of them from the team of the frozen copy. */
function parseLineup(raw: unknown, { memberIds }: TeamRoster): readonly MemberId[] | null {
  const lineup = parseLineupMembers(raw);
  return lineup?.every((id) => memberIds.includes(id)) === true ? lineup : null;
}

function parseBenchMembers(raw: unknown): readonly MemberId[] | null {
  return parseUniqueMemberIds(raw, MIN_BENCH_MEMBERS, MAX_BENCH_MEMBERS);
}

/** A copy of the indexes, so that a sparse array or an item of another type fails the check. */
function parseReplacedIndexes(raw: unknown): readonly number[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_LIBERO_REPLACED_INDEXES) {
    return null;
  }
  const items: readonly unknown[] = Array.from(raw as readonly unknown[]);
  const indexes = items.filter((item): item is number => typeof item === "number");
  return indexes.length === items.length && isLiberoCoverage(indexes) ? indexes : null;
}

/**
 * Format only, and `null` turns the libero off: someone who is neither in the lineup nor on the
 * bench, covering one position or a diagonal. Who the team has is for the partition.
 */
function parseLiberoFormat(
  raw: unknown,
  lineup: readonly MemberId[],
  bench: readonly MemberId[],
): TeamLibero | null | undefined {
  if (raw === null) return null;
  if (!isPlainObject(raw)) return undefined;
  const memberId = readOwn(raw, "memberId");
  if (!isUuid(memberId) || lineup.includes(memberId) || bench.includes(memberId)) return undefined;
  const replacedIndexes = parseReplacedIndexes(readOwn(raw, "replacedIndexes"));
  return replacedIndexes === null ? undefined : { memberId, replacedIndexes };
}

function parseTeamState(
  raw: unknown,
  roster: TeamRoster,
  fields: {
    readonly team: ScorePayloadField;
    readonly lineup: ScorePayloadField;
    readonly setterZone: ScorePayloadField;
    readonly system: ScorePayloadField;
    readonly bench: ScorePayloadField;
    readonly libero: ScorePayloadField;
  },
): ParseResult<TeamState | null> {
  if (raw === null) return ok(null);
  if (!isPlainObject(raw)) return invalid(fields.team);
  const lineup = parseLineup(readOwn(raw, "lineup"), roster);
  if (lineup === null) return invalid(fields.lineup);
  const setterZone = readOwn(raw, "setterZone");
  if (!isSetterZone(setterZone)) return invalid(fields.setterZone);
  const system = readOwn(raw, "system");
  if (!isFormationSystem(system)) return invalid(fields.system);
  const bench = parseBenchMembers(readOwn(raw, "bench"));
  if (bench === null) return invalid(fields.bench);
  const libero = parseLiberoFormat(readOwn(raw, "libero"), lineup, bench);
  if (libero === undefined || !isLiberoAllowed(system, libero)) return invalid(fields.libero);
  if (libero !== null && !roster.memberIds.includes(libero.memberId)) return invalid(fields.libero);
  // Whoever of the frozen copy is not in the lineup nor the libero, each one once.
  if (!isRosterPartition(lineup, bench, libero, roster)) return invalid(fields.bench);
  return ok({ bench, libero, lineup, setterZone, system });
}

function parseRotations(raw: unknown, teams: MatchTeams): ParseResult<TeamRotations> {
  if (!isPlainObject(raw)) return invalid("rotations");
  const a = parseTeamState(readOwn(raw, "a"), teams.a, {
    team: "rotations.a",
    lineup: "rotations.a.lineup",
    setterZone: "rotations.a.setterZone",
    system: "rotations.a.system",
    bench: "rotations.a.bench",
    libero: "rotations.a.libero",
  });
  if (!a.ok) return a;
  const b = parseTeamState(readOwn(raw, "b"), teams.b, {
    team: "rotations.b",
    lineup: "rotations.b.lineup",
    setterZone: "rotations.b.setterZone",
    system: "rotations.b.system",
    bench: "rotations.b.bench",
    libero: "rotations.b.libero",
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

function parseQueueTeam(raw: unknown): TeamRoster | null {
  if (!isPlainObject(raw)) return null;
  const memberIds = parseMemberIds(readOwn(raw, "memberIds"));
  return memberIds === null ? null : { memberIds };
}

/** Each team from 1 to `MAX_TEAM_MEMBERS`, and nobody in two of them. */
function parseQueueTeams(raw: unknown): readonly TeamRoster[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_QUEUE_MEMBERS) {
    return null;
  }
  const items: readonly unknown[] = Array.from(raw as readonly unknown[]);
  const teams = items.map(parseQueueTeam).filter((team): team is TeamRoster => team !== null);
  if (teams.length !== items.length) {
    return null;
  }
  const members = teams.flatMap(({ memberIds }) => memberIds);
  return new Set(members).size === members.length ? teams : null;
}

/** Format only: teams, then players, nobody twice, and at most `MAX_QUEUE_MEMBERS` in all. */
function parseQueue(raw: unknown): ParseResult<TeamQueue> {
  if (!isPlainObject(raw)) return invalid("queue");
  const teams = parseQueueTeams(readOwn(raw, "teams"));
  if (teams === null) return invalid("queue.teams");
  const players = parseUniqueMemberIds(readOwn(raw, "players"), 0, MAX_QUEUE_MEMBERS);
  const inTeams = teams.flatMap(({ memberIds }) => memberIds);
  if (players === null || players.some((id) => inTeams.includes(id))) {
    return invalid("queue.players");
  }
  const queue = { players, teams };
  return queueSize(queue) > MAX_QUEUE_MEMBERS ? invalid("queue") : ok(queue);
}

/** Last, because it is checked against `teams`: nobody waiting is on the court. */
function parseMatchQueue(raw: unknown, teams: MatchTeams): ParseResult<TeamQueue> {
  const queue = parseQueue(raw);
  if (!queue.ok) return queue;
  return isQueueOverlappingTeams(queue.value, teams) ? invalid("queue") : queue;
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
  const matchId = readOwn(raw, "matchId");
  if (!isUuid(matchId)) return invalid("matchId");
  const setNumber = readOwn(raw, "setNumber");
  if (!isSetNumber(setNumber)) return invalid("setNumber");
  const servingTeam = readOwn(raw, "servingTeam");
  if (!isTeamSide(servingTeam)) return invalid("servingTeam");
  const firstServer = readOwn(raw, "firstServer");
  if (!isTeamSide(firstServer)) return invalid("firstServer");
  return ok({ firstServer, matchId, servingTeam, setNumber });
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
]);

/** Fails closed: a type outside the score catalog has no valid payload here. */
export function parseScorePayload(type: string, payload: unknown): ParseResult<ScorePayload> {
  const parser = PARSERS_BY_TYPE.get(type);
  return parser === undefined ? invalid(PAYLOAD_ROOT_FIELD) : parser(payload);
}
