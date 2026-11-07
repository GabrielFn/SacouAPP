// Teams of a match: rosters, lineups, bench and libero.
import { ok, type FormationSystem } from "@sacou/volley-rules";

import { isUuid } from "../../event-log/is-uuid.js";
import { MAX_LIBERO_REPLACED_INDEXES } from "../constants.data.js";
import { isLiberoAllowed, isLiberoCoverage, isRosterPartition } from "../rotation-rules.js";
import type {
  MatchTeams,
  MemberId,
  ScorePayloadField,
  TeamLibero,
  TeamRoster,
  TeamRotations,
  TeamState,
} from "../types.js";
import {
  invalid,
  isFormationSystem,
  isPlainObject,
  isSetterZone,
  parseBenchMembers,
  parseLineupMembers,
  parseMemberIds,
  readOwn,
  type ParseResult,
} from "./payload-reading.js";

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

/** Exactly one player per position, and all of them from the team of the frozen copy. */
function parseLineup(raw: unknown, { memberIds }: TeamRoster): readonly MemberId[] | null {
  const lineup = parseLineupMembers(raw);
  return lineup?.every((id) => memberIds.includes(id)) === true ? lineup : null;
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

interface TeamStateFields {
  readonly team: ScorePayloadField;
  readonly lineup: ScorePayloadField;
  readonly setterZone: ScorePayloadField;
  readonly system: ScorePayloadField;
  readonly bench: ScorePayloadField;
  readonly libero: ScorePayloadField;
}

interface TeamMembers {
  readonly lineup: readonly MemberId[];
  readonly bench: readonly MemberId[];
  readonly roster: TeamRoster;
}

/** The libero of a team state: allowed by the system and part of the frozen copy. */
function parseTeamLibero(
  raw: unknown,
  system: FormationSystem,
  { lineup, bench, roster }: TeamMembers,
): TeamLibero | null | undefined {
  const libero = parseLiberoFormat(raw, lineup, bench);
  if (libero === undefined || !isLiberoAllowed(system, libero)) return undefined;
  if (libero !== null && !roster.memberIds.includes(libero.memberId)) return undefined;
  return libero;
}

function parseTeamState(
  raw: unknown,
  roster: TeamRoster,
  fields: TeamStateFields,
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
  const libero = parseTeamLibero(readOwn(raw, "libero"), system, { lineup, bench, roster });
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
