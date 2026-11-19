/**
 * Types of the hidden OpenSkill rating (E3.9, ADR 0047 and 0071). Nothing here is shown to a player
 * in the pilot: the API keeps the result internal. The key order of every output is the contract
 * with the C# port (golden `golden/rating-pools.json`).
 */

/** The parameters of the model, versioned in `rating-params.json` (ADR 0071). */
export interface RatingParams {
  readonly ratingParamsVersion: number;
  /** μ of level 3.0. */
  readonly mu0: number;
  /** μ for one level (1.0) above or below 3.0 (ADR 0018). */
  readonly levelStep: number;
  /** σ of a seed the admin confirmed. */
  readonly sigmaAdmin: number;
  /** σ of a suggested or default seed. */
  readonly sigmaUnconfirmed: number;
  readonly beta: number;
  readonly tau: number;
  readonly kappa: number;
  readonly limitSigma: boolean;
}

/** Where the level of a member comes from, as `IMemberLevels` resolves it (E1.3). */
export const LEVEL_SOURCES = ["admin", "suggested", "default"] as const;
export type LevelSource = (typeof LEVEL_SOURCES)[number];

/** A level in tenths, 10 (1.0) to 50 (5.0), and where it comes from. */
export interface MemberLevel {
  readonly levelTenths: number;
  readonly source: LevelSource;
}

/** The seed of a member: the current resolved level (question 98, option 1). */
export interface MemberSeed extends MemberLevel {
  readonly memberId: string;
}

export interface Skill {
  readonly mu: number;
  readonly sigma: number;
}

export const TEAM_SIDES = ["a", "b"] as const;
export type TeamSide = (typeof TEAM_SIDES)[number];

export type BySide<T> = Readonly<Record<TeamSide, T>>;

/** The modalities of `format.modality` (`docs/dominio/configuracao.md`). */
export const MODALITIES = ["indoor-6x6", "beach-2x2", "beach-4x4"] as const;
export type Modality = (typeof MODALITIES)[number];

/** Indoor and beach are rated apart; the two beach modalities share a pool (ADR 0071). */
export const RATING_POOLS = ["indoor", "beach"] as const;
export type RatingPool = (typeof RATING_POOLS)[number];

/**
 * A finished match as `getMatchResults` gives it (match engine). Only `winner`, `teams` and
 * `onCourt` matter; the shape is structural, so the engine result fits without a dependency.
 */
export interface RatedMatch {
  readonly matchId: string;
  readonly winner: TeamSide | null;
  readonly teams: BySide<readonly string[]>;
  readonly onCourt: BySide<readonly string[]>;
}

/** A round of the group with its finished matches, in the order of the `MatchEnded` events. */
export interface RatedRound {
  readonly roundId: string;
  /** ISO 8601 instant in UTC (`2026-11-19T22:00:00Z`): ordered as text, so the form is fixed. */
  readonly startsAt: string;
  readonly canceled: boolean;
  readonly modality: Modality;
  readonly matches: readonly RatedMatch[];
}

/** The rating of a member in a pool, with the seed it started from (risk 5, calibration). */
export interface MemberRating {
  readonly memberId: string;
  readonly pool: RatingPool;
  readonly seedTenths: number;
  readonly seedSource: LevelSource;
  readonly mu: number;
  readonly sigma: number;
  readonly matchesRated: number;
}
