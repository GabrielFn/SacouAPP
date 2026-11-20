import { strings } from "../../../strings/pt-BR";
import { isBusy, type CardShareFailure, type CardShareState } from "./card-share.reducer";

export { isBusy };

const { cardShare } = strings.profile;

export function failureTextOf(reason: CardShareFailure): string {
  return cardShare.failures[reason];
}

/** The line under the buttons: the failure, the "saved" note, or nothing. */
export function noticeOf(state: CardShareState): string | null {
  switch (state.status) {
    case "failed":
      return failureTextOf(state.reason);
    case "saved":
      return cardShare.saved;
    case "idle":
    case "capturing":
    case "sharing":
    case "saving":
      return null;
  }
}

/** The settings shortcut shows only after a refused permission. */
export function offersSettings(state: CardShareState): boolean {
  return state.status === "failed" && state.reason === "permission-denied";
}
