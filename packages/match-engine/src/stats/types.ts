import type { MemberId, TeamSide } from "../score/types.js";
import type { SettingsModality } from "../settings/types.js";
import type { CREDITED_POINT_KINDS, MATCH_RESULTS, MVP_KINDS } from "./constants.data.js";

export type MatchResult = (typeof MATCH_RESULTS)[number];
export type CreditedPointKind = (typeof CREDITED_POINT_KINDS)[number];
export type MvpKind = (typeof MVP_KINDS)[number];

/** One value for each side of the court, `a` then `b`. */
export type BySide<T> = Readonly<Record<TeamSide, T>>;

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

/**
 * A finished match as the projections and the rating need it (E3.9): the teams as in the
 * `MatchStarted`, who of them stood on the court in at least one active rally (the bench that never
 * came in is only in `teams`), and the rallies each side won. The key order is the contract with the
 * C# port.
 */
export interface FinishedMatchResult {
  readonly matchId: string;
  readonly winner: TeamSide | null;
  readonly teams: BySide<readonly MemberId[]>;
  readonly onCourt: BySide<readonly MemberId[]>;
  readonly points: BySide<number>;
}

/** The options of the round that change its summary, from the resolved settings (E3.9). */
export interface RoundSummaryOptions {
  readonly modality: SettingsModality;
  readonly mvpEnabled: boolean;
  readonly mvpByStats: boolean;
  readonly individualPoints: boolean;
}

/** "Time que mais venceu" of screen 12: the side with more wins, `null` on a tie. */
export interface MostWinsHighlight {
  readonly side: TeamSide;
  readonly wins: number;
}

/** "Maior sequência" of screen 12: the side with the longest run of wins, `null` on a tie. */
export interface LongestStreakHighlight {
  readonly side: TeamSide;
  readonly longestWinStreak: number;
}

export interface SideHighlights {
  readonly mostWins: MostWinsHighlight | null;
  readonly longestStreak: LongestStreakHighlight | null;
}

/**
 * A pair or a four of the sand on the ranking of the day (ADR 0048): the same members, in any order,
 * are the same team. Members in the order of the first match of the team.
 */
export interface BeachTeamStanding {
  readonly memberIds: readonly MemberId[];
  readonly wins: number;
  readonly losses: number;
  readonly undecided: number;
  readonly longestWinStreak: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
}

/**
 * The MVP of the day from the scoreboard (question 97). On the court, one member and the side they
 * played the most; on the sand, the team first on the ranking, without a side. `plusMinus` of a
 * team is the balance of its points.
 */
export interface DayMvp {
  readonly kind: MvpKind;
  readonly memberIds: readonly MemberId[];
  readonly side: TeamSide | null;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly plusMinus: number;
  readonly longestWinStreak: number;
}

/** The after-game of a court session (E3.9): screens 12, 12b, 14 and 15 read it. */
export interface RoundSummary {
  readonly mvpFormulaVersion: number;
  readonly finishedMatches: readonly FinishedMatchResult[];
  readonly players: readonly PlayerStats[];
  readonly sides: SideHighlights;
  readonly mvp: DayMvp | null;
  /** Only on the sand; `null` on the court. */
  readonly ranking: readonly BeachTeamStanding[] | null;
}
