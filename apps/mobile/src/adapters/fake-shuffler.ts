import type { Shuffler } from "../services/random/shuffler";

export interface FakeShuffler extends Shuffler {
  /** How many times `shuffle` ran. */
  calls(): number;
}

/** A shuffle for tests: always the reverse order, and it counts its calls. */
export function createFakeShuffler(): FakeShuffler {
  const count = { value: 0 };
  return {
    shuffle<T>(items: readonly T[]): readonly T[] {
      count.value += 1;
      return [...items].reverse();
    },
    calls: () => count.value,
  };
}
