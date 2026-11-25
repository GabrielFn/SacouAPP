import type { EndRoundAvailability } from "./end-round-availability";

/** Why "Encerrar rodada" did not go through: the one the server refuses, and the phone's own storage. */
export type EndRoundFailure = "round-not-started" | "storage";

/** What the confirmation says before the round is closed (R101): all of it known when the user asks. */
export interface EndRoundRequest {
  /** "12 × 10" with a match in play (it stays out of the summary, question 151), else `null`. */
  readonly openMatchScore: string | null;
  /** Matches finished on this court so far. */
  readonly finishedMatches: number;
  /** The MVP voting opens for 24 h when the round ends. */
  readonly votingEnabled: boolean;
  /** Before the start time with no match finished the server refuses: the sheet only explains (ADR 0076). */
  readonly availability: EndRoundAvailability;
}

/**
 * What the flow of "Encerrar rodada" keeps (frontend.md, rule 4): only the phase and, while asking, what
 * the dialog says. The session lives in the log and the end of the round on the server.
 */
export type EndRoundState =
  | { readonly phase: "idle" }
  /** Always asked first (R101, 3a): ending the round has no way back. */
  | ({ readonly phase: "confirming" } & EndRoundRequest)
  | { readonly phase: "closing" }
  | { readonly phase: "failed"; readonly failure: EndRoundFailure };

export type EndRoundAction =
  | ({ readonly type: "requested" } & EndRoundRequest)
  | { readonly type: "confirmed" }
  | { readonly type: "cancelled" }
  | { readonly type: "closed" }
  | { readonly type: "failed"; readonly failure: EndRoundFailure };

export const INITIAL_END_ROUND: EndRoundState = { phase: "idle" };

const CLOSING: EndRoundState = { phase: "closing" };

function requested(state: EndRoundState, request: EndRoundRequest): EndRoundState {
  if (state.phase === "closing" || state.phase === "confirming") return state;
  return {
    phase: "confirming",
    openMatchScore: request.openMatchScore,
    finishedMatches: request.finishedMatches,
    votingEnabled: request.votingEnabled,
    availability: request.availability,
  };
}

function cancelled(state: EndRoundState): EndRoundState {
  return state.phase === "confirming" || state.phase === "failed" ? INITIAL_END_ROUND : state;
}

export function endRoundReducer(state: EndRoundState, action: EndRoundAction): EndRoundState {
  switch (action.type) {
    case "requested":
      return requested(state, action);
    case "confirmed":
      return state.phase === "confirming" ? CLOSING : state;
    case "cancelled":
      return cancelled(state);
    case "closed":
      return state.phase === "closing" ? INITIAL_END_ROUND : state;
    case "failed":
      return state.phase === "closing" ? { phase: "failed", failure: action.failure } : state;
  }
}
