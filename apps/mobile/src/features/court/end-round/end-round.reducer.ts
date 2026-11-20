/** Why "Encerrar rodada" did not go through: the one the server refuses, and the phone's own storage. */
export type EndRoundFailure = "round-not-started" | "storage";

/**
 * What the flow of "Encerrar rodada" keeps (frontend.md, rule 4): only the phase and, while asking, the
 * score of the match that stays out. The session lives in the log and the end of the round on the server.
 */
export type EndRoundState =
  | { readonly phase: "idle" }
  /** A match is in play: it stays out of the summary (question 151), so the user confirms first. */
  | { readonly phase: "confirming"; readonly openMatchScore: string }
  | { readonly phase: "closing" }
  | { readonly phase: "failed"; readonly failure: EndRoundFailure };

export type EndRoundAction =
  /** The user asked to end the round; `openMatchScore` is "12 × 10" with a match in play, else `null`. */
  | { readonly type: "requested"; readonly openMatchScore: string | null }
  | { readonly type: "confirmed" }
  | { readonly type: "cancelled" }
  | { readonly type: "closed" }
  | { readonly type: "failed"; readonly failure: EndRoundFailure };

export const INITIAL_END_ROUND: EndRoundState = { phase: "idle" };

export function endRoundReducer(state: EndRoundState, action: EndRoundAction): EndRoundState {
  switch (action.type) {
    case "requested":
      if (state.phase === "closing" || state.phase === "confirming") return state;
      return action.openMatchScore === null
        ? { phase: "closing" }
        : { phase: "confirming", openMatchScore: action.openMatchScore };
    case "confirmed":
      return state.phase === "confirming" ? { phase: "closing" } : state;
    case "cancelled":
      return state.phase === "confirming" || state.phase === "failed" ? INITIAL_END_ROUND : state;
    case "closed":
      return state.phase === "closing" ? INITIAL_END_ROUND : state;
    case "failed":
      return state.phase === "closing" ? { phase: "failed", failure: action.failure } : state;
  }
}
