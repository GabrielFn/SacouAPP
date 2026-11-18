import type { RandomSource } from "../services/random/random-source";

/** Only the variation of the backoff uses it: nothing here needs to be unpredictable. */
export const mathRandomSource: RandomSource = { next: () => Math.random() };
