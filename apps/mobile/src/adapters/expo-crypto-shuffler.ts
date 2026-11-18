import { getRandomValues } from "expo-crypto";

import type { Shuffler } from "../services/random/shuffler";

/** 2^32, the range of one random `Uint32`. */
const UINT32_RANGE = 0x1_0000_0000;
const ONE_VALUE = 1;

/** A random index from 0 to `bound - 1`, with rejection so no index is likelier than another. */
function randomIndex(bound: number): number {
  const limit = UINT32_RANGE - (UINT32_RANGE % bound);
  const sample = getRandomValues(new Uint32Array(ONE_VALUE))[0] ?? 0;
  return sample < limit ? sample % bound : randomIndex(bound);
}

/** Picks the next item at random from what is left, until nothing is (a team has at most 24). */
function shuffleFrom<T>(remaining: readonly T[], picked: readonly T[]): readonly T[] {
  if (remaining.length === 0) return picked;
  const index = randomIndex(remaining.length);
  return shuffleFrom(
    [...remaining.slice(0, index), ...remaining.slice(index + ONE_VALUE)],
    [...picked, ...remaining.slice(index, index + ONE_VALUE)],
  );
}

/** A uniform permutation from the system generator, the same source as the ids and the coin. */
export const expoCryptoShuffler: Shuffler = {
  shuffle: (items) => shuffleFrom(items, []),
};
