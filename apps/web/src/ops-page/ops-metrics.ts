import { isRecord } from "../adapters/api-client";

import { isCount, isWeekDate, listOf } from "./ops-body-parts";
import { gateOf, groupsOf, roundsOf } from "./ops-gate-body";
import type { OpsEnvironment, OpsMetrics, OpsUserWeek, OpsUsers } from "./ops-page.types";

type Body = Readonly<Record<string, unknown>>;

function userWeekOf(value: unknown): OpsUserWeek | null {
  if (!isRecord(value)) return null;
  const { weekStart, registered, deleted } = value;
  if (!isWeekDate(weekStart) || !isCount(registered) || !isCount(deleted)) return null;
  return { weekStart, registered, deleted };
}

function usersOf(value: unknown): OpsUsers | null {
  if (!isRecord(value)) return null;
  const weeks = listOf(value.weeks, userWeekOf);
  const { registered, deleted } = value;
  if (weeks === null || !isCount(registered) || !isCount(deleted)) return null;
  return { registered, deleted, weeks };
}

function environmentOf(value: unknown): OpsEnvironment | null {
  return value === "test" || value === "production" ? value : null;
}

function instantOf(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** The body of `GET /v1/ops/metrics`, or null when any field is off its shape (the page then says it failed). */
export function opsMetricsOf(body: unknown): OpsMetrics | null {
  if (!isRecord(body)) return null;
  const fields: Body = body;
  const environment = environmentOf(fields.environment);
  const generatedAt = instantOf(fields.generatedAt);
  const users = usersOf(fields.users);
  const groups = groupsOf(fields.groups);
  const rounds = roundsOf(fields.rounds);
  const gate = gateOf(fields.gate);
  if (environment === null || generatedAt === null || users === null) return null;
  if (groups === null || rounds === null || gate === null) return null;
  return { environment, generatedAt, users, groups, rounds, gate };
}
