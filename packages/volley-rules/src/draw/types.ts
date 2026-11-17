/** The meter of screen 07: each team's average and the gap between the highest and the lowest, in tenths. */
export interface DrawBalance {
  readonly averagesTenths: readonly number[];
  readonly differenceTenths: number;
}

/** A team with nobody, or a draw with no team, has no average. */
export type DrawBalanceError = { readonly code: "empty-team" } | { readonly code: "no-teams" };
