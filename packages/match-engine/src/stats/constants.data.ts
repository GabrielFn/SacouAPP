import type { PointKind } from "../score/types.js";
import type { SettingsModality } from "../settings/types.js";

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

/**
 * Version of the rule that picks the MVP of the day from the scoreboard (E3.9, question 97). It goes
 * with every round summary: changing the rule bumps it and every projection is computed again.
 */
export const MVP_FORMULA_VERSION = 1;

/** The modalities played on the sand: the day ranks the pairs or the fours (ADR 0048). */
export const BEACH_MODALITIES = [
  "beach-2x2",
  "beach-4x4",
] as const satisfies readonly SettingsModality[];

/** Who the MVP of the day is: one or more members, or a pair or four of the sand (E3.18, L1). */
export const MVP_KINDS = ["player", "team"] as const;
