import { apiErrorTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import type { EndRoundFailure, EndRoundRequest, EndRoundState } from "./end-round.reducer";

/** What the screens show of the flow, derived from the phase and never stored (rule 1). */
export interface EndRoundView {
  /** The dialog is open: "Encerrar rodada" is always asked first (R101). */
  readonly confirming: boolean;
  /** What the dialog says: the matches, the one in play, the consequence; `null` while closed. */
  readonly confirmingBody: string | null;
  /** The server and the log are being written: the buttons wait. */
  readonly busy: boolean;
  readonly failure: string | null;
}

export function endRoundFailureText(failure: EndRoundFailure): string {
  switch (failure) {
    case "round-not-started":
      return apiErrorTexts["sessions.round-not-started"];
    case "storage":
      return strings.court.endRound.storageFailed;
  }
}

function matchesSentence(finished: number): string {
  const { endRound } = strings.court;
  if (finished === 0) return endRound.noMatches;
  return finished === 1 ? endRound.oneMatch : endRound.manyMatches(finished);
}

/** The sentences of the dialog, in order: matches played, the one in play, the consequence. */
export function endRoundBody(request: EndRoundRequest): string {
  const { endRound } = strings.court;
  const consequence = request.votingEnabled ? endRound.consequenceWithVoting : endRound.consequence;
  const inPlay =
    request.openMatchScore === null ? [] : [endRound.openMatch(request.openMatchScore)];
  return [matchesSentence(request.finishedMatches), ...inPlay, consequence].join(" ");
}

const NOT_ASKING = { confirming: false, confirmingBody: null, failure: null } as const;

export function endRoundView(state: EndRoundState): EndRoundView {
  switch (state.phase) {
    case "idle":
      return { ...NOT_ASKING, busy: false };
    case "confirming":
      return { ...NOT_ASKING, confirming: true, confirmingBody: endRoundBody(state), busy: false };
    case "closing":
      return { ...NOT_ASKING, busy: true };
    case "failed":
      return { ...NOT_ASKING, busy: false, failure: endRoundFailureText(state.failure) };
  }
}
