import { isRecord } from "../adapters/api-client";

import { isCount, isWeekDate, listOf } from "./ops-body-parts";
import type {
  OpsGate,
  OpsGateCount,
  OpsGateGroup,
  OpsGateWeek,
  OpsGroups,
  OpsRoundWeek,
  OpsRounds,
} from "./ops-page.types";

/** A rate of the API: `0..1`, or null when nothing was counted. Anything else is off the shape. */
function isRate(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && value >= 0 && value <= 1);
}

export function groupsOf(value: unknown): OpsGroups | null {
  if (!isRecord(value)) return null;
  const { total, active } = value;
  return isCount(total) && isCount(active) ? { total, active } : null;
}

function roundWeekOf(value: unknown): OpsRoundWeek | null {
  if (!isRecord(value)) return null;
  const { weekStart, created } = value;
  return isWeekDate(weekStart) && isCount(created) ? { weekStart, created } : null;
}

export function roundsOf(value: unknown): OpsRounds | null {
  if (!isRecord(value)) return null;
  const weeks = listOf(value.weeks, roundWeekOf);
  const { created, held, closed, canceled } = value;
  if (weeks === null || !isCount(created) || !isCount(held)) return null;
  if (!isCount(closed) || !isCount(canceled)) return null;
  return { created, held, closed, canceled, weeks };
}

function countOf(value: unknown): OpsGateCount | null {
  if (!isRecord(value)) return null;
  const { rounds, confirmed, selfAnswered, byLink, rate, linkRate } = value;
  if (!isCount(rounds) || !isCount(confirmed) || !isCount(selfAnswered) || !isCount(byLink)) {
    return null;
  }
  if (!isRate(rate) || !isRate(linkRate)) return null;
  return { rounds, confirmed, selfAnswered, byLink, rate, linkRate };
}

function gateWeekOf(value: unknown): OpsGateWeek | null {
  if (!isRecord(value)) return null;
  const count = countOf(value.count);
  const { weekStart } = value;
  return isWeekDate(weekStart) && count !== null ? { weekStart, count } : null;
}

function gateGroupOf(value: unknown): OpsGateGroup | null {
  if (!isRecord(value)) return null;
  const count = countOf(value.count);
  const { name, longestStreak, meetsGate } = value;
  if (typeof name !== "string" || count === null) return null;
  if (!isCount(longestStreak) || typeof meetsGate !== "boolean") return null;
  return { name, count, longestStreak, meetsGate };
}

function goalsOf(value: Readonly<Record<string, unknown>>) {
  const { target, requiredWeeks, groupsGoal, groupsMeeting } = value;
  if (typeof target !== "number" || !isRate(target)) return null;
  if (!isCount(requiredWeeks) || !isCount(groupsGoal) || !isCount(groupsMeeting)) return null;
  return { target, requiredWeeks, groupsGoal, groupsMeeting };
}

export function gateOf(value: unknown): OpsGate | null {
  if (!isRecord(value)) return null;
  const goals = goalsOf(value);
  const total = countOf(value.total);
  const weeks = listOf(value.weeks, gateWeekOf);
  const byGroup = listOf(value.byGroup, gateGroupOf);
  if (goals === null || total === null || weeks === null || byGroup === null) return null;
  return { ...goals, total, weeks, byGroup };
}
