import type { CourtSessionState } from "@sacou/match-engine";
import { useEffect, useRef } from "react";

import { useServices } from "../../../services/services-context";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { playChangeFeedback } from "../session/play-change-feedback";
import { useCourtSession } from "./use-court-session";

/**
 * Buzzes the phone for what the log just did, after it is stored: it compares the state before and
 * after each change of the log. The first state it sees (opening or resuming) buzzes nothing.
 */
export function useCourtFeedback(): void {
  const { courtFeedback } = useServices();
  const { view } = useCourtSession();
  const seen = useRef<CourtSessionState | null>(null);
  const timeline = view.status === "ready" ? view.timeline : null;

  useEffect(() => {
    if (timeline === null) {
      return;
    }
    const after = stateOfTimeline(timeline);
    const before = seen.current;
    seen.current = after;
    playChangeFeedback(courtFeedback, before, after);
  }, [timeline, courtFeedback]);
}
