import { useMemo } from "react";

import { withUploadNotice } from "../model/hint-line";
import {
  selectCourtPhase,
  selectCourtScreen,
  stateOfTimeline,
} from "../model/court-screen.selectors";
import type { CourtPhase, CourtScreenModel } from "../model/court-screen.types";
import type { CourtRoster } from "../ports/court-roster";
import type { CourtSessionView } from "./use-court-session";

export interface CourtScreenModelView {
  /** Another phone writes the court now: the 09b replaces it (D7). */
  readonly takenOver: boolean;
  readonly phase: CourtPhase | null;
  readonly model: CourtScreenModel | null;
}

/**
 * What the court route draws, derived from the session view: the phase and the model, with the upload
 * notice on the middle line (question 85). Taken over, there is no phase: nothing opens the end of a
 * set or of the match.
 */
export function useCourtScreenModel(
  view: CourtSessionView,
  roster: CourtRoster,
): CourtScreenModelView {
  const notice = view.status === "ready" ? view.notice : null;
  const takenOver = notice?.kind === "taken-over";
  const timeline = view.status === "ready" && !takenOver ? view.timeline : null;
  const phase = useMemo(
    () => (timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline))),
    [timeline],
  );
  const model = useMemo(() => {
    if (timeline === null) return null;
    const screen = selectCourtScreen(timeline, roster);
    return screen === null ? null : { ...screen, hint: withUploadNotice(screen.hint, notice) };
  }, [timeline, roster, notice]);
  return { takenOver, phase, model };
}
