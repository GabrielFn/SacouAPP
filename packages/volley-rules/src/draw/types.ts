/** The meter of screen 07: each team's average and the gap between the highest and the lowest, in tenths. */
export interface DrawBalance {
  readonly averagesTenths: readonly number[];
  readonly differenceTenths: number;
}

/** A team with nobody, or a draw with no team, has no average. */
export type DrawBalanceError = { readonly code: "empty-team" } | { readonly code: "no-teams" };

/** How the confirmed players split: `teamCount` teams of `teamSize`, and `reserveCount` waiting. */
export interface DrawLayout {
  readonly teamCount: number;
  readonly teamSize: number;
  readonly reserveCount: number;
}

/** The teams in order, each in order of arrival, and the reserves in the order of the queue. */
export interface DrawSplit<T> {
  readonly teams: readonly (readonly T[])[];
  readonly reserves: readonly T[];
}

/** Fewer than 4 players, or a team size that is not a positive whole number. */
export type DrawSplitError =
  { readonly code: "not-enough-players" } | { readonly code: "invalid-size" };
