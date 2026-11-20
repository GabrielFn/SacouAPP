import { failureText, standingText, webStrings } from "../strings.pt-BR";
import type { RoundPageState, SheetForm, Standing } from "../round-page/round-page.types";

import {
  renderSignInSheet,
  write,
  type Control,
  type SheetElements,
  type TextSlot,
  type ViewEnvironment,
} from "./sign-in-sheet";

export type { Control, Field, Shown, TextSlot, ViewEnvironment } from "./sign-in-sheet";

/** The nodes of the page the script drives; the server renders them, with their first texts (screen 01, screen 02). */
export interface PageElements extends SheetElements {
  readonly going: Control | null;
  readonly notGoing: Control | null;
  readonly status: TextSlot;
  readonly signOut: Control;
}

const SHEET_STEPS = new Set<RoundPageState["step"]>([
  "signIn",
  "signingIn",
  "nickname",
  "savingNickname",
]);
const BUSY_STEPS = new Set<RoundPageState["step"]>([
  "starting",
  "signingIn",
  "registering",
  "savingNickname",
  "answering",
]);

function holdsPlace(standing: Standing | null): boolean {
  return standing !== null && standing.status !== "notGoing";
}

function formOf(state: RoundPageState): SheetForm | "nickname" | null {
  switch (state.step) {
    case "signIn":
      return state.form;
    case "signingIn":
      return state.attempt === "google" ? "choice" : state.attempt;
    case "nickname":
    case "savingNickname":
      return "nickname";
    case "starting":
    case "idle":
    case "registering":
    case "answering":
      return null;
  }
}

function statusText(state: RoundPageState): string | null {
  if (state.step === "idle") {
    if (state.failure !== null) return failureText(state.failure);
    return state.standing === null ? null : standingText(state.standing);
  }
  return state.step === "registering" || state.step === "answering" ? webStrings.working : null;
}

function sheetMessage(state: RoundPageState): string | null {
  if (state.step === "signIn") {
    if (state.failure !== null) return failureText(state.failure);
    return state.notice === "resetSent" ? webStrings.resetSent : null;
  }
  if (state.step === "nickname" && state.failure !== null) return failureText(state.failure);
  return BUSY_STEPS.has(state.step) && SHEET_STEPS.has(state.step) ? webStrings.working : null;
}

function renderAnswers(elements: PageElements, state: RoundPageState): void {
  const busy = BUSY_STEPS.has(state.step);
  const standing = state.step === "idle" || state.step === "answering" ? state.standing : null;
  const placed = holdsPlace(standing);
  if (elements.going !== null) {
    elements.going.disabled = busy;
    elements.going.hidden = placed;
  }
  if (elements.notGoing !== null) {
    elements.notGoing.disabled = busy;
    elements.notGoing.hidden = standing?.status === "notGoing";
    elements.notGoing.textContent = placed ? webStrings.notGoingAnymore : webStrings.notGoingLabel;
  }
  elements.signOut.hidden = !(state.step === "idle" && state.signedIn);
}

function renderSheet(
  elements: PageElements,
  state: RoundPageState,
  environment: ViewEnvironment,
): void {
  const form = formOf(state);
  renderSignInSheet(
    elements,
    {
      form,
      title: form === null ? webStrings.sheet.choice : webStrings.sheet[form],
      busy: BUSY_STEPS.has(state.step),
      message: sheetMessage(state),
    },
    environment,
  );
}

/** The whole page from the state: the same state always draws the same page. */
export function renderRoundPage(
  elements: PageElements,
  state: RoundPageState,
  environment: ViewEnvironment,
): void {
  renderAnswers(elements, state);
  write(elements.status, statusText(state));
  renderSheet(elements, state, environment);
}
