import {
  BACKOFF_GROWTH,
  BACKOFF_JITTER,
  BACKOFF_JITTER_SPAN,
  FIRST_BACKOFF_MS,
  MAX_BACKOFF_MS,
} from "./sync.data";

export { BACKOFF_JITTER, MAX_BACKOFF_MS } from "./sync.data";

/**
 * The wait before the `attempt`-th new try (1 for the first), with the variation taken from `jitter`,
 * a sample in [0, 1). Never above the ceiling.
 */
export function backoffDelayMs(attempt: number, jitter: number): number {
  const exponent = Math.max(0, attempt - 1);
  const base = Math.min(FIRST_BACKOFF_MS * BACKOFF_GROWTH ** exponent, MAX_BACKOFF_MS);
  const factor = 1 - BACKOFF_JITTER + BACKOFF_JITTER_SPAN * jitter;
  return Math.min(Math.round(base * factor), MAX_BACKOFF_MS);
}
