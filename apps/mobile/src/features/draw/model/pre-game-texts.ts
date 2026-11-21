import { drawStrings } from "../../../strings/draw.pt-BR";
import type { StartFromDrawError } from "../session/start-from-draw";
import type { StartBlocker } from "./pre-game-selectors";

const { blocked } = drawStrings.preGame;

const BLOCKER_TEXT: Readonly<Record<StartBlocker, string>> = {
  stale: blocked.stale,
  "open-match": blocked.openMatch,
  "other-round-open": blocked.otherRound,
  "other-round-other-account": blocked.otherRoundOtherAccount,
};

const START_ERROR_TEXT: Readonly<Record<StartFromDrawError, string>> = {
  "other-round-match-open": blocked.otherRound,
  "match-open": blocked.openMatch,
  failed: blocked.failed,
  "other-account": blocked.otherAccount,
  "no-account": blocked.noAccount,
  "close-other-failed": blocked.closeOtherFailed,
};

/** Why "Começar partida" is off, as the sheet says it (D6). */
export function startBlockerText(blocker: StartBlocker): string {
  return BLOCKER_TEXT[blocker];
}

/** Why the last start did not open the court (D7). */
export function startErrorText(error: StartFromDrawError): string {
  return START_ERROR_TEXT[error];
}
