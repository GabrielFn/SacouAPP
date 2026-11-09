export interface Summary {
  readonly median: number;
  readonly p95: number;
  readonly max: number;
}

const HALF = 0.5;
const P95 = 0.95;

/** The value at a rank between 0 and 1 of the sorted samples (nearest rank, no interpolation). */
function atRank(sorted: readonly number[], rank: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * rank) - 1));
  return sorted[index] ?? 0;
}

/** Median, 95th percentile and maximum; zeros for no samples. */
export function summarize(samples: readonly number[]): Summary {
  const sorted = [...samples].sort((first, second) => first - second);
  return { median: atRank(sorted, HALF), p95: atRank(sorted, P95), max: sorted.at(-1) ?? 0 };
}
