import { COURT_FLEX_WEIGHTS, LANDSCAPE_FLEX_WEIGHTS } from "../court.data";
import type { CourtLayout } from "./court-layout";

/** The flex weight of the bottom strip: the queue and the battery alert share it, so the court never moves. */
export function bottomStripWeight(layout: CourtLayout): number {
  return layout.kind === "landscape" ? LANDSCAPE_FLEX_WEIGHTS.queue : COURT_FLEX_WEIGHTS.queue;
}
