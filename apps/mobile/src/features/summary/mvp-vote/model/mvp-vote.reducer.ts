import type { ApiError } from "../../../../services/api/api-error";

/**
 * Only what exists nowhere else (rule 1): the choice not sent yet, the phase of the sending and the
 * last refusal. The vote that was sent lives in the query cache (`myVote`), never here.
 */
export interface MvpVoteState {
  readonly selected: string | null;
  readonly phase: "choosing" | "submitting" | "failed";
  readonly error: ApiError | null;
}

export type MvpVoteAction =
  | { readonly type: "candidate-selected"; readonly memberId: string }
  | { readonly type: "submit-requested" }
  | { readonly type: "submit-failed"; readonly error: ApiError }
  | { readonly type: "submit-succeeded" }
  | { readonly type: "error-dismissed" };

/** Nothing chosen at first (question 171): a choice made for the person would steer the vote. */
export const INITIAL_MVP_VOTE: MvpVoteState = { selected: null, phase: "choosing", error: null };

function selected(state: MvpVoteState, memberId: string): MvpVoteState {
  return state.phase === "submitting"
    ? state
    : { selected: memberId, phase: "choosing", error: null };
}

/** A second tap while sending, or a tap with nobody chosen, changes nothing. */
function requested(state: MvpVoteState): MvpVoteState {
  if (state.selected === null || state.phase === "submitting") return state;
  return { ...state, phase: "submitting", error: null };
}

function failed(state: MvpVoteState, error: ApiError): MvpVoteState {
  return state.phase === "submitting" ? { ...state, phase: "failed", error } : state;
}

function dismissed(state: MvpVoteState): MvpVoteState {
  return state.phase === "failed" ? { ...state, phase: "choosing", error: null } : state;
}

export function mvpVoteReducer(state: MvpVoteState, action: MvpVoteAction): MvpVoteState {
  switch (action.type) {
    case "candidate-selected":
      return selected(state, action.memberId);
    case "submit-requested":
      return requested(state);
    case "submit-failed":
      return failed(state, action.error);
    case "submit-succeeded":
      return INITIAL_MVP_VOTE;
    case "error-dismissed":
      return dismissed(state);
  }
}

/** Whether "Votar em ..." sends: someone chosen, a network, and nothing on the way already. */
export function canSubmit(state: MvpVoteState, online: boolean): boolean {
  return state.selected !== null && online && state.phase !== "submitting";
}
