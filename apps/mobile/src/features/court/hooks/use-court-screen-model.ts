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
import type { SyncNotice } from "../sync/sync-notice";
import type { CourtSessionView } from "./use-court-session";

/** Why the court takes no gesture: another phone writes it (09b, D7), or another account opened it (D8). */
export type CourtBlock = Extract<SyncNotice, { kind: "taken-over" | "other-account" }>["kind"];

export interface CourtScreenModelView {
  /** The court is replaced by a screen that only leaves, or `null`. */
  readonly block: CourtBlock | null;
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
  const block =
    notice?.kind === "taken-over" || notice?.kind === "other-account" ? notice.kind : null;
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
  return { block, timeline, phase, model };
}
