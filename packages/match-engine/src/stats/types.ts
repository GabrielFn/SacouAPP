import type { MemberId, TeamSide } from "../score/types.js";
import type { CREDITED_POINT_KINDS, MATCH_RESULTS } from "./constants.data.js";

export type MatchResult = (typeof MATCH_RESULTS)[number];
export type CreditedPointKind = (typeof CREDITED_POINT_KINDS)[number];

/** Points a member scored, by "De quem foi?", in the order of `CREDITED_POINT_KINDS`. */
export type PointsByKind = Readonly<Record<CreditedPointKind, number>>;

/** Wins in a row: the longest run, and the run that ends with the last finished match. */
export interface WinStreaks {
  readonly longestWinStreak: number;
  readonly currentWinStreak: number;
}

/** Points scored and conceded while the member stood on the court. */
export interface CourtBalance {
  readonly pointsFor: number;
  readonly pointsAgainst: number;
}

/**
 * The round of a member on one court, from the finished matches only. Only IDs and integers: the
 * screens find the names and compute any percentage. The key order is the contract with the C# port
 * (ADR 0032).
 */
export interface PlayerStats {
  readonly memberId: MemberId;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly undecided: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly plusMinus: number;
  readonly longestWinStreak: number;
  readonly currentWinStreak: number;
  /** One per finished match the member played, in order: E3.9 chains the streaks across rounds. */
  readonly results: readonly MatchResult[];
  readonly pointsByKind: PointsByKind;
}

/** A side of the court counts as a team, whoever plays on it (ADR 0032, P3). */
export interface SideStats extends WinStreaks {
  readonly wins: number;
}

/** By side, `a` then `b`. */
export type SidesStats = Readonly<Record<TeamSide, SideStats>>;
