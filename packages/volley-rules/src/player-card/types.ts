import type { PLAYER_CARD_TIERS } from "./constants.data.js";

export type PlayerCardTier = (typeof PLAYER_CARD_TIERS)[number];

export interface PlayerCardLevel {
  /** The displayed level as a whole number of tenths: 38 reads as 3.8. */
  readonly levelTenths: number;
  readonly tier: PlayerCardTier;
}

export interface PlayerCardLevelError {
  readonly code: "invalid-rating";
}
