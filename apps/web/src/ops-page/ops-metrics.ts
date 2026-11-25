import { isRecord } from "../adapters/api-client";

import type { OpsEnvironment, OpsMetrics, OpsUserWeek, OpsUsers } from "./ops-page.types";

const WEEK_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Body = Readonly<Record<string, unknown>>;

export function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isWeekDate(value: unknown): value is string {
  return typeof value === "string" && WEEK_DATE.test(value);
}

/** A list of which every item `parse` accepts, or null. */
export function listOf<T>(value: unknown, parse: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  const items = (value as readonly unknown[]).map(parse);
  const kept = items.filter((item): item is T => item !== null);
  return kept.length === items.length ? kept : null;
}

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
  if (environment === null || generatedAt === null || users === null) return null;
  return { environment, generatedAt, users };
}
