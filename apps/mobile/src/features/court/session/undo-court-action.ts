import type { CourtSessionTimeline, TeamSide } from "@sacou/match-engine";

import { stateOfTimeline } from "../model/court-screen.selectors";
import { describeUndo, undoNoticeText } from "../model/undo-notice";
import type { PlayCommand } from "./command-drafts";
import type { CommandResult } from "./court-session-controller";

export interface UndoCourtActionDeps {
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
  readonly teamLabel: (matchId: string, side: TeamSide) => string;
  /** Called once the undo went through: the guard, then the line of the middle strip. */
  readonly onUndone: (noticeText: string | null) => void;
}

/**
 * DESFAZER of the court. The line is worked out before the command, from the action about to be
 * taken back. It never buzzes, not even when the engine turns it down (ADR 0030): there is no
 * feedback port here on purpose.
 */
export async function undoCourtAction(
  timeline: CourtSessionTimeline | null,
  { dispatch, teamLabel, onUndone }: UndoCourtActionDeps,
): Promise<void> {
  const undone = timeline === null ? null : describeUndo(timeline);
  const matchId = timeline === null ? undefined : stateOfTimeline(timeline).currentMatch?.matchId;
  const result = await dispatch({ type: "undo" });
  if (!result.ok) {
    return;
  }
  onUndone(
    undone !== null && matchId !== undefined
      ? undoNoticeText(undone, (side) => teamLabel(matchId, side))
      : null,
  );
}
