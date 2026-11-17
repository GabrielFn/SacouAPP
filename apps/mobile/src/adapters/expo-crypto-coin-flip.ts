import { getRandomBytes } from "expo-crypto";

import type { CoinFlip } from "../services/random/coin-flip";

const ONE_BYTE = 1;
const LOWEST_BIT = 1;

/** One random bit of the system generator, as the ids of `expo-crypto` (D10). */
export const expoCryptoCoinFlip: CoinFlip = {
  flip: () => ((getRandomBytes(ONE_BYTE)[0] ?? 0) & LOWEST_BIT ? "b" : "a"),
};
