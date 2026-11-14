import {
  clampStep,
  FIXED_EXIT_RANGE,
  WINNER_WINS_RANGE,
  type ExitMode,
  type QueueRuleDraft,
} from "./queue-rule";

export interface QueueRuleState {
  readonly draft: QueueRuleDraft;
  /** The text of the last refusal of the server, or `null`. */
  readonly message: string | null;
}

export type QueueRuleAction =
  | { readonly type: "mode-selected"; readonly mode: ExitMode }
  | { readonly type: "fixed-count-stepped"; readonly delta: number }
  | { readonly type: "winner-toggled"; readonly enabled: boolean }
  | { readonly type: "winner-wins-stepped"; readonly delta: number }
  | { readonly type: "save-failed"; readonly message: string }
  | { readonly type: "message-cleared" };

export function initialQueueRuleState(draft: QueueRuleDraft): QueueRuleState {
  return { draft, message: null };
}

export function queueRuleReducer(state: QueueRuleState, action: QueueRuleAction): QueueRuleState {
  const { draft } = state;
  switch (action.type) {
    case "mode-selected":
      return { draft: { ...draft, exitMode: action.mode }, message: null };
    case "fixed-count-stepped":
      return {
        draft: {
          ...draft,
          fixedExitCount: clampStep(draft.fixedExitCount + action.delta, FIXED_EXIT_RANGE),
        },
        message: null,
      };
    case "winner-toggled":
      // Turning it off keeps the number, so turning it on again finds the same X.
      return { draft: { ...draft, winnerExitEnabled: action.enabled }, message: null };
    case "winner-wins-stepped":
      return {
        draft: {
          ...draft,
          winnerExitWins: clampStep(draft.winnerExitWins + action.delta, WINNER_WINS_RANGE),
        },
        message: null,
      };
    case "save-failed":
      return { ...state, message: action.message };
    case "message-cleared":
      return { ...state, message: null };
  }
}
