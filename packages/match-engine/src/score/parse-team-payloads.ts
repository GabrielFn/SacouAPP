import { ok, ROTATION_SLOTS } from "@sacou/volley-rules";

import { isUuid } from "../event-log/is-uuid.js";
import {
  MAX_BENCH_MEMBERS,
  MAX_LIBERO_REPLACED_INDEXES,
  MAX_QUEUE_MEMBERS,
  MIN_BENCH_MEMBERS,
} from "./constants.data.js";
import {
  invalid,
  isFormationSystem,
  isPlainObject,
  isSetterZone,
  parseMemberIds,
  parseUniqueMemberIds,
  readOwn,
  type ParseResult,
} from "./payload-reading.js";
import { isQueueOverlappingTeams, queueSize } from "./queue-rules.js";
import { isLiberoAllowed, isLiberoCoverage, isRosterPartition } from "./rotation-rules.js";
import type {
  MatchTeams,
  MemberId,
  ScorePayloadField,
  TeamLibero,
  TeamQueue,
  TeamRoster,
  TeamRotations,
  TeamState,
} from "./types.js";

function parseRoster(
  raw: unknown,
  rosterField: ScorePayloadField,
  memberIdsField: ScorePayloadField,
): ParseResult<TeamRoster> {
  if (!isPlainObject(raw)) return invalid(rosterField);
  const memberIds = parseMemberIds(readOwn(raw, "memberIds"));
  return memberIds === null ? invalid(memberIdsField) : ok({ memberIds });
}

export function parseTeams(raw: unknown): ParseResult<MatchTeams> {
  if (!isPlainObject(raw)) return invalid("teams");
  const a = parseRoster(readOwn(raw, "a"), "teams.a", "teams.a.memberIds");
  if (!a.ok) return a;
  const b = parseRoster(readOwn(raw, "b"), "teams.b", "teams.b.memberIds");
  if (!b.ok) return b;
  const hasSharedMember = b.value.memberIds.some((id) => a.value.memberIds.includes(id));
  return hasSharedMember ? invalid("teams.b.memberIds") : ok({ a: a.value, b: b.value });
}

export function parseLineupMembers(raw: unknown): readonly MemberId[] | null {
  return parseUniqueMemberIds(raw, ROTATION_SLOTS.length, ROTATION_SLOTS.length);
}

/** Exactly one player per position, and all of them from the team of the frozen copy. */
function parseLineup(raw: unknown, { memberIds }: TeamRoster): readonly MemberId[] | null {
  const lineup = parseLineupMembers(raw);
  return lineup?.every((id) => memberIds.includes(id)) === true ? lineup : null;
}

export function parseBenchMembers(raw: unknown): readonly MemberId[] | null {
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
export function parseLiberoFormat(
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

/** The libero of a team that starts a match: its format, allowed by the system, from the roster. */
function parseMatchLibero(
  raw: unknown,
  {
    bench,
    lineup,
    roster,
    system,
  }: Pick<TeamState, "bench" | "lineup" | "system"> & { readonly roster: TeamRoster },
): TeamLibero | null | undefined {
  const libero = parseLiberoFormat(raw, lineup, bench);
  if (libero === undefined || !isLiberoAllowed(system, libero)) return undefined;
  return libero !== null && !roster.memberIds.includes(libero.memberId) ? undefined : libero;
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
  const libero = parseMatchLibero(readOwn(raw, "libero"), { bench, lineup, roster, system });
  if (libero === undefined) return invalid(fields.libero);
  // Whoever of the frozen copy is not in the lineup nor the libero, each one once.
  if (!isRosterPartition(lineup, bench, libero, roster)) return invalid(fields.bench);
  return ok({ bench, libero, lineup, setterZone, system });
}

export function parseRotations(raw: unknown, teams: MatchTeams): ParseResult<TeamRotations> {
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
export function parseQueue(raw: unknown): ParseResult<TeamQueue> {
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
export function parseMatchQueue(raw: unknown, teams: MatchTeams): ParseResult<TeamQueue> {
  const queue = parseQueue(raw);
  if (!queue.ok) return queue;
  return isQueueOverlappingTeams(queue.value, teams) ? invalid("queue") : queue;
}
