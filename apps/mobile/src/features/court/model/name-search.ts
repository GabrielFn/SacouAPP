/** How many tries the search may take before it gives up. */
export const SEARCH_BUDGET = 20000;

interface Search<T> {
  readonly choices: readonly (readonly T[])[];
  readonly clash: (a: T, b: T) => boolean;
}

interface Outcome<T> {
  readonly found: readonly T[] | null;
  readonly budget: number;
}

function walk<T>(search: Search<T>, placed: readonly T[], budget: number): Outcome<T> {
  const candidates = search.choices[placed.length];
  return candidates === undefined
    ? { found: placed, budget }
    : tryFrom(search, placed, candidates, 0, budget);
}

function tryFrom<T>(
  search: Search<T>,
  placed: readonly T[],
  candidates: readonly T[],
  at: number,
  budget: number,
): Outcome<T> {
  const candidate = candidates[at];
  if (candidate === undefined || budget <= 0) return { found: null, budget };
  const left = budget - 1;
  if (placed.some((other) => search.clash(candidate, other))) {
    return tryFrom(search, placed, candidates, at + 1, left);
  }
  const deeper = walk(search, [...placed, candidate], left);
  return deeper.found !== null
    ? deeper
    : tryFrom(search, placed, candidates, at + 1, deeper.budget);
}

/**
 * One candidate of each choice, none clashing with another: the candidates of each choice are tried
 * in their order, and a choice left without one makes the one before it take its next candidate.
 * `null` when there is no such pick or the budget runs out first. Pure and deterministic.
 */
export function pickCompatible<T>(
  choices: readonly (readonly T[])[],
  clash: (a: T, b: T) => boolean,
  budget: number = SEARCH_BUDGET,
): readonly T[] | null {
  return walk({ choices, clash }, [], budget).found;
}
