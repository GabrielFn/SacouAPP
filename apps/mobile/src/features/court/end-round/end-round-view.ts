import { apiErrorTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import type { EndRoundFailure, EndRoundState } from "./end-round.reducer";

/** What the screens show of the flow, derived from the phase and never stored (rule 1). */
export interface EndRoundView {
  /** The score ("12 × 10") of the match that stays out while the dialog is open, else `null`. */
  readonly confirmingScore: string | null;
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

export function endRoundView(state: EndRoundState): EndRoundView {
  switch (state.phase) {
    case "idle":
      return { confirmingScore: null, busy: false, failure: null };
    case "confirming":
      return { confirmingScore: state.openMatchScore, busy: false, failure: null };
    case "closing":
      return { confirmingScore: null, busy: true, failure: null };
    case "failed":
      return { confirmingScore: null, busy: false, failure: endRoundFailureText(state.failure) };
  }
}
