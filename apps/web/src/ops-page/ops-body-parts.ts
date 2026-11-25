const WEEK_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A count of the API: a whole number, never negative. */
export function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** The Monday that names a week, `YYYY-MM-DD`. */
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
