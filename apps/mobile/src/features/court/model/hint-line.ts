import type { TeamSide } from "@sacou/match-engine";

/** What the line in the middle strip says; the text itself is in `strings`. */
export type HintLine =
  | { readonly kind: "positions" }
  | { readonly kind: "closes-set"; readonly side: TeamSide }
  | { readonly kind: "next-point-closes" };

const SINGLE_SET_POINT = 1;

/** By priority: both teams at set point, one team at set point, then the default. */
export function selectHintLine(setPointSides: readonly TeamSide[]): HintLine {
  const [first] = setPointSides;
  if (first === undefined) {
    return { kind: "positions" };
  }
  return setPointSides.length === SINGLE_SET_POINT
    ? { kind: "closes-set", side: first }
    : { kind: "next-point-closes" };
}
