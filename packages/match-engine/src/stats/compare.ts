/**
 * The first criterion that tells two candidates apart, from a list of comparisons in order of
 * importance: negative when the first candidate comes first, `0` when every criterion ties.
 */
export function firstDifference(comparisons: readonly number[]): number {
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

/** The candidate that comes first; on a tie, the earliest one in the list (stable). */
export function firstOf<T>(candidates: readonly T[], compare: (x: T, y: T) => number): T | null {
  return candidates.reduce<T | null>(
    (best, candidate) => (best === null || compare(candidate, best) < 0 ? candidate : best),
    null,
  );
}
