import type { FeedbackKind } from "../model/feedback";

/** What the phone does in the hand when something happens on the court (produto.md:138). */
export interface CourtFeedback {
  play(kind: FeedbackKind): void;
}
