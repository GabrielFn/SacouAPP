/** The waits after a failure of the network or of the server: 2, 4, 8, 16, 32 and then 60 s (D3). */
export const FIRST_BACKOFF_MS = 2_000;
export const MAX_BACKOFF_MS = 60_000;
/** ±20%, so two phones that failed together do not try again together. */
export const BACKOFF_JITTER = 0.2;
const GROWTH = 2;

/**
 * The wait before the `attempt`-th new try (1 for the first), with the variation taken from `jitter`,
 * a sample in [0, 1). Never above the ceiling.
 */
export function backoffDelayMs(attempt: number, jitter: number): number {
  const exponent = Math.max(0, attempt - 1);
  const base = Math.min(FIRST_BACKOFF_MS * GROWTH ** exponent, MAX_BACKOFF_MS);
  const factor = 1 - BACKOFF_JITTER + 2 * BACKOFF_JITTER * jitter;
  return Math.min(Math.round(base * factor), MAX_BACKOFF_MS);
}
