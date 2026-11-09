import {
  confirmSetEnd,
  INITIAL_COURT_SESSION_STATE,
  scorePoint,
  startMatch,
  undoLastAction,
  type ConfirmSetEndOptions,
  type CourtSessionState,
  type CourtSessionTimeline,
  type MatchStartedPayload,
  type TeamSide,
} from "@sacou/match-engine";
import { err, type Result } from "@sacou/volley-rules";

import type { CommandError, CommandRefusalReason } from "./court-errors";
import type { EventDraft } from "./envelope-factory";

/** What the screens ask of a court session. Each one becomes events through the engine. */
export type CourtCommand =
  | { readonly type: "start-match"; readonly input: MatchStartedPayload }
  | { readonly type: "score-point"; readonly team: TeamSide }
  | { readonly type: "undo" }
  | { readonly type: "confirm-set-end"; readonly firstServer?: TeamSide };

export type DraftsResult = Result<readonly EventDraft[], CommandError>;

function currentState(timeline: CourtSessionTimeline): CourtSessionState {
  const last = timeline.entries[timeline.entries.length - 1];
  return last === undefined ? INITIAL_COURT_SESSION_STATE : last.state;
}

function refused(
  result: Result<readonly EventDraft[], { readonly code: CommandRefusalReason }>,
): DraftsResult {
  return result.ok ? result : err({ code: "refused", reason: result.error.code });
}

function confirmOptions(firstServer: TeamSide | undefined): ConfirmSetEndOptions {
  return firstServer === undefined ? {} : { firstServer };
}

/** Runs the command of the engine on the state at the moment of execution, never on a stale one. */
export function draftsFor(command: CourtCommand, timeline: CourtSessionTimeline): DraftsResult {
  const state = currentState(timeline);
  switch (command.type) {
    case "start-match":
      return refused(startMatch(state, command.input));
    case "score-point":
      return refused(scorePoint(state, command.team));
    case "confirm-set-end":
      return refused(confirmSetEnd(state, confirmOptions(command.firstServer)));
    case "undo":
      return refused(undoLastAction(timeline));
  }
}
