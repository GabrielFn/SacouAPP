import type { TeamSide } from "@sacou/match-engine";

import type { CoinFlip } from "../services/random/coin-flip";

/** A coin for tests: the sides in the given order, over and over. */
export function createFakeCoinFlip(sides: readonly TeamSide[]): CoinFlip {
  const next = { index: 0 };
  return {
    flip() {
      const side = sides[next.index % sides.length] ?? "a";
      next.index += 1;
      return side;
    },
  };
}
