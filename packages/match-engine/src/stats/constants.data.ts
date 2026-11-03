import type { PointKind } from "../score/types.js";

/** How a finished match went for a member or a side: without a winner it is neither (ADR 0032). */
export const MATCH_RESULTS = ["win", "loss", "undecided"] as const;

/**
 * The kinds of point that have an author, in the order of `POINT_KINDS`: an error of the opponent
 * credits nobody (ADR 0031). A literal, because a data file holds no logic; a test checks that it is
 * `POINT_KINDS` without `AUTHORLESS_POINT_KINDS`.
 */
export const CREDITED_POINT_KINDS = [
  "attack",
  "block",
  "ace",
  "other",
] as const satisfies readonly PointKind[];
