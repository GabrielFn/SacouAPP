// The queue of the court: waiting teams and players.
import { ok } from "@sacou/volley-rules";

import { MAX_QUEUE_MEMBERS } from "../constants.data.js";
import { isQueueOverlappingTeams, queueSize } from "../queue-rules.js";
import type { MatchTeams, TeamQueue, TeamRoster } from "../types.js";
import {
  invalid,
  isPlainObject,
  parseMemberIds,
  parseUniqueMemberIds,
  readOwn,
  type ParseResult,
} from "./payload-reading.js";

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
