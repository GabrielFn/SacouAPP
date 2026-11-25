import { apiErrorTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import type { EndRoundFailure, EndRoundRequest, EndRoundState } from "./end-round.reducer";

/** What the screens show of the flow, derived from the phase and never stored (rule 1). */
/**
 * What the open sheet is: "Encerrar rodada" is always asked first (R101) with the matches, the one in
 * play and the consequence; before the start time with no match finished it only explains (ADR 0076).
 */
export type EndRoundSheet =
  | { readonly kind: "confirm"; readonly body: string }
  | { readonly kind: "not-started"; readonly body: string };

export interface EndRoundView {
  /** The sheet that is open, or `null` while closed. */
  readonly sheet: EndRoundSheet | null;
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

const NOT_ASKING = { sheet: null, failure: null } as const;

function sheetOf(request: EndRoundRequest): EndRoundSheet {
  return request.availability === "not-started"
    ? { kind: "not-started", body: strings.court.endRound.notStarted }
    : { kind: "confirm", body: endRoundBody(request) };
}

export function endRoundView(state: EndRoundState): EndRoundView {
  switch (state.phase) {
    case "idle":
      return { ...NOT_ASKING, busy: false };
    case "confirming":
      return { ...NOT_ASKING, sheet: sheetOf(state), busy: false };
    case "closing":
      return { ...NOT_ASKING, busy: true };
    case "failed":
      return { ...NOT_ASKING, busy: false, failure: endRoundFailureText(state.failure) };
  }
}
