import { err, ok, type Result } from "../result.js";
import {
  ANCHOR_LEVEL_TENTHS,
  ANCHOR_RATING,
  ELITE_MIN_LEVEL_TENTHS,
  GOLD_MIN_LEVEL_TENTHS,
  MAX_LEVEL_TENTHS,
  MIN_LEVEL_TENTHS,
  RATING_POINTS_PER_TENTH,
  ROUND_HALF_UP_OFFSET,
  SILVER_MIN_LEVEL_TENTHS,
} from "./constants.data.js";
import type { PlayerCardLevel, PlayerCardLevelError, PlayerCardTier } from "./types.js";

/** The tier comes from the displayed level, so a card never reads "2.5 bronze". */
export function playerCardLevelFromRating(
  rating: number,
): Result<PlayerCardLevel, PlayerCardLevelError> {
  if (!Number.isFinite(rating)) {
    return err({ code: "invalid-rating" });
  }
  const levelTenths = levelTenthsFromRating(rating);
  return ok({ levelTenths, tier: tierFromLevelTenths(levelTenths) });
}

function levelTenthsFromRating(rating: number): number {
  const exactTenths = (rating - ANCHOR_RATING) / RATING_POINTS_PER_TENTH + ANCHOR_LEVEL_TENTHS;
  const roundedTenths = Math.floor(exactTenths + ROUND_HALF_UP_OFFSET);
  return Math.min(Math.max(roundedTenths, MIN_LEVEL_TENTHS), MAX_LEVEL_TENTHS);
}

function tierFromLevelTenths(levelTenths: number): PlayerCardTier {
  if (levelTenths >= ELITE_MIN_LEVEL_TENTHS) {
    return "elite";
  }
  if (levelTenths >= GOLD_MIN_LEVEL_TENTHS) {
    return "gold";
  }
  return levelTenths >= SILVER_MIN_LEVEL_TENTHS ? "silver" : "bronze";
}
