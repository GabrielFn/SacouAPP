export const PLAYER_CARD_TIERS = Object.freeze(["bronze", "silver", "gold", "elite"] as const);

/** The rating that converts exactly to level 3.0. */
export const ANCHOR_RATING = 1500;
export const ANCHOR_LEVEL_TENTHS = 30;

/** 100 rating points are worth 0.5 of a level (ADR 0018). */
export const RATING_POINTS_PER_TENTH = 20;

/** Added before `Math.floor` so that halves round up, on every platform. */
export const ROUND_HALF_UP_OFFSET = 0.5;

export const MIN_LEVEL_TENTHS = 10;
export const MAX_LEVEL_TENTHS = 50;

export const SILVER_MIN_LEVEL_TENTHS = 25;
export const GOLD_MIN_LEVEL_TENTHS = 35;
export const ELITE_MIN_LEVEL_TENTHS = 45;
