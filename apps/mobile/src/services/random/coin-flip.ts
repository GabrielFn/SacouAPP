import type { TeamSide } from "@sacou/match-engine";

/** "Sortear" of who serves first on sheet 08 (D10): never `Math.random` in a screen. */
export interface CoinFlip {
  flip(): TeamSide;
}
