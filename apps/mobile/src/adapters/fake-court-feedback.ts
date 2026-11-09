import type { FeedbackKind } from "../features/court/model/feedback";
import type { CourtFeedback } from "../features/court/ports/court-feedback";

export interface FakeCourtFeedback extends CourtFeedback {
  played(): readonly FeedbackKind[];
}

export function createFakeCourtFeedback(): FakeCourtFeedback {
  const log = { value: [] as readonly FeedbackKind[] };
  return {
    play(kind) {
      log.value = [...log.value, kind];
    },
    played: () => log.value,
  };
}
