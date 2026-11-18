import type { CourtSessionTimeline } from "@sacou/match-engine";
import { useMemo } from "react";

import { withUploadNotice } from "../model/hint-line";
import {
  selectCourtPhase,
  selectCourtScreen,
  stateOfTimeline,
} from "../model/court-screen.selectors";
import type { CourtPhase, CourtScreenModel } from "../model/court-screen.types";
import type { CourtRoster } from "../ports/court-roster";
import { localScoreOf, type BlockedCourt } from "../takeover/blocked-court";
import type { BackdropScore } from "../takeover/takeover-texts";
import type { CourtSessionView } from "./use-court-session";

export interface CourtScreenModelView {
  /** The court is replaced by a screen without its gestures (09b, 09c, D8), or `null`. */
  readonly block: BlockedCourt | null;
  /** The score of this phone behind a blocked court (09b, 09c), or `null`. */
  readonly blockedScore: BackdropScore | null;
  /** `null` while loading, failed or blocked. */
  readonly timeline: CourtSessionTimeline | null;
  readonly phase: CourtPhase | null;
  readonly model: CourtScreenModel | null;
}

/**
 * What the court route draws, derived from the session view: the phase and the model, with the upload
 * notice on the middle line (question 85). Blocked, there is no phase: nothing opens the end of a
 * set or of the match.
 */
export function useCourtScreenModel(
  view: CourtSessionView,
  roster: CourtRoster,
): CourtScreenModelView {
  const notice = view.status === "ready" ? view.notice : null;
  const block = view.status === "ready" ? view.blocked : null;
  const timeline = view.status === "ready" && block === null ? view.timeline : null;
  const phase = useMemo(
    () => (timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline))),
    [timeline],
  );
  const model = useMemo(() => {
    if (timeline === null) return null;
    const screen = selectCourtScreen(timeline, roster);
    return screen === null ? null : { ...screen, hint: withUploadNotice(screen.hint, notice) };
  }, [timeline, roster, notice]);
  const blockedScore = useMemo(
    () => (view.status === "ready" && block !== null ? localScoreOf(view.timeline) : null),
    [view, block],
  );
  return { block, blockedScore, timeline, phase, model };
}
