/** Anything that belongs to one match of the court session. */
interface OfMatch {
  readonly matchId: string;
}

/**
 * Splits items in timeline order by match. Only one match is open at a time and a `matchId` is
 * unique in the stream, so the items of a match are always contiguous: one pass, without a mutable
 * accumulator.
 */
export function groupByMatch<T extends OfMatch>(
  items: readonly T[],
): ReadonlyMap<string, readonly T[]> {
  const starts = items.flatMap((item, index) =>
    items[index - 1]?.matchId === item.matchId ? [] : [index],
  );
  const runs = starts.map((start, position) => items.slice(start, starts[position + 1]));
  return new Map(
    runs.flatMap((run) => {
      const [first] = run;
      return first === undefined ? [] : [[first.matchId, run] as const];
    }),
  );
}

/**
 * Adds up a match into a `Map` that never escapes mutable: each step copies it, and a match has at
 * most two full teams, so a copy stays small (ADR 0032).
 */
export function tally<T, V>(
  items: readonly T[],
  updatesOf: (item: T, current: ReadonlyMap<string, V>) => readonly (readonly [string, V])[],
): ReadonlyMap<string, V> {
  return items.reduce<ReadonlyMap<string, V>>(
    (current, item) => new Map([...current, ...updatesOf(item, current)]),
    new Map(),
  );
}
