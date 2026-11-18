import type { TeamSide } from "@sacou/match-engine";

/** What the line in the middle strip says; the text itself is in `strings`. */
export type HintLine =
  | { readonly kind: "positions" }
  | { readonly kind: "closes-set"; readonly side: TeamSide }
  | { readonly kind: "next-point-closes" }
  /** The coin of the next match picked who serves; gone with the first point (question 81). */
  | { readonly kind: "first-server-drawn"; readonly side: TeamSide };

const SINGLE_SET_POINT = 1;

/**
 * By priority: the draw of a next match (before its first point), both teams at set point, one team
 * at set point, then the default.
 */
export function selectHintLine(
  setPointSides: readonly TeamSide[],
  drawnFirstServer: TeamSide | null = null,
): HintLine {
  if (drawnFirstServer !== null) {
    return { kind: "first-server-drawn", side: drawnFirstServer };
  }
  const [first] = setPointSides;
  if (first === undefined) {
    return { kind: "positions" };
  }
  return setPointSides.length === SINGLE_SET_POINT
    ? { kind: "closes-set", side: first }
    : { kind: "next-point-closes" };
}
