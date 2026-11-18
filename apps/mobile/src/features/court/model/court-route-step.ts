import type { CourtPhase } from "./court-screen.types";

/** The routes of the court that decide where to go from the phase of the match. */
export type CourtRouteName = "court" | "set-end";

/** What a route does about the phase it is in; navigation itself stays in the component. */
export type CourtStep = "none" | "open-set-end" | "open-match-end" | "go-back";

/**
 * The one place that routes the court by phase, used by the court and by the end of the set:
 * - the court opens the end of the set when the set is decided (or the match waits for its end), and
 *   the result when the match ended
 *   (only while in front, so the one under the end of the set waits for it);
 * - the end of the set goes back when the next set is being played, and straight to the result when
 *   the confirmation ended the match (the deciding set stores `SetEnded` and `MatchEnded` together).
 */
export function nextCourtRoute(
  route: CourtRouteName,
  phase: CourtPhase | null,
  focused: boolean,
): CourtStep {
  if (route === "set-end") {
    if (phase === "match-ended") return "open-match-end";
    return phase === "playing" ? "go-back" : "none";
  }
  if (phase === "set-decided" || phase === "match-pending") return "open-set-end";
  return phase === "match-ended" && focused ? "open-match-end" : "none";
}
