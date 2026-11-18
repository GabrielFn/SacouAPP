import type { CourtSessionState } from "@sacou/match-engine";

import { feedbackOnChange } from "../model/feedback";
import type { CourtFeedback } from "../ports/court-feedback";

/** Buzzes for what the log did between two states; an undo, or no change, buzzes nothing. */
export function playChangeFeedback(
  feedback: CourtFeedback,
  before: CourtSessionState | null,
  after: CourtSessionState,
): void {
  const kind = feedbackOnChange(before, after);
  if (kind !== null) {
    feedback.play(kind);
  }
}
