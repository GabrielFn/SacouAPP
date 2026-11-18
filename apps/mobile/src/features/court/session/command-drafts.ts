import {
  changeLineup,
  confirmSetEnd,
  endMatchManually,
  INITIAL_COURT_SESSION_STATE,
  revertToEvent,
  scorePoint,
  shiftRotation,
  startMatch,
  switchServingTeam,
  undoLastAction,
  type ConfirmSetEndOptions,
  type CourtSessionState,
  type CourtSessionTimeline,
  type LineupAllocation,
  type MatchStartedPayload,
  type RotationDirection,
  type TeamSide,
} from "@sacou/match-engine";
import { err, type Result } from "@sacou/volley-rules";

import { manualEndWinner } from "../model/manual-end-winner";
import type { CommandError, CommandRefusalReason } from "./court-errors";
import type { EventDraft } from "./envelope-factory";

/** What the screens ask of a court session. Each one becomes events through the engine. */
export type CourtCommand =
  | { readonly type: "start-match"; readonly input: MatchStartedPayload }
  | { readonly type: "score-point"; readonly team: TeamSide }
  | { readonly type: "undo" }
  | { readonly type: "confirm-set-end"; readonly firstServer?: TeamSide }
  /** "Trocar sacador" of screen 24. */
  | { readonly type: "switch-serving-team" }
  /** "Girar / desgirar" of screen 24. */
  | {
      readonly type: "shift-rotation";
      readonly team: TeamSide;
      readonly direction: RotationDirection;
    }
  /** "Voltar para este ponto" of screen 24. */
  | { readonly type: "revert-to"; readonly eventId: string }
  /** "Confirmar e ir para a próxima partida" of screen 11: the `MatchStarted` the plan built (D7). */
  | { readonly type: "start-next-match"; readonly input: MatchStartedPayload }
  /** "Encerrar partida" of the menu: the winner is worked out when it runs (D3). */
  | { readonly type: "end-match-manually" }
  /** "Salvar escalação" of screen 22 in a match: the whole allocation, never the `system` (E4.8, D7). */
  | {
      readonly type: "change-lineup";
      readonly team: TeamSide;
      readonly allocation: LineupAllocation;
    };

/** What a screen can ask for: starting a match goes only through `startCourtMatch`. */
export type PlayCommand = Exclude<CourtCommand, { readonly type: "start-match" }>;

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

function manualWinnerOf(state: CourtSessionState): TeamSide | null {
  return state.currentMatch === null ? null : manualEndWinner(state.currentMatch);
}

/** Runs the command of the engine on the state at the moment of execution, never on a stale one. */
export function draftsFor(command: CourtCommand, timeline: CourtSessionTimeline): DraftsResult {
  const state = currentState(timeline);
  switch (command.type) {
    case "start-match":
    case "start-next-match":
      return refused(startMatch(state, command.input));
    case "score-point":
      return refused(scorePoint(state, command.team));
    case "confirm-set-end":
      return refused(confirmSetEnd(state, confirmOptions(command.firstServer)));
    case "undo":
      return refused(undoLastAction(timeline));
    case "switch-serving-team":
      return refused(switchServingTeam(state));
    case "shift-rotation":
      return refused(shiftRotation(state, command.team, command.direction));
    case "revert-to":
      return refused(revertToEvent(timeline, command.eventId));
    case "end-match-manually":
      return refused(endMatchManually(state, manualWinnerOf(state)));
    case "change-lineup":
      return refused(changeLineup(state, command.team, command.allocation));
  }
}
