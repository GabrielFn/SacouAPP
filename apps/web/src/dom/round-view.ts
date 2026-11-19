import { failureText, standingText, webStrings } from "../strings.pt-BR";
import type { RoundPageState, SheetForm, Standing } from "../round-page/round-page.types";

/** What the view writes on a node: text through `textContent` only, never HTML (lint forbids `innerHTML` and the like). */
export interface Shown {
  /** `boolean | "until-found"` in the DOM; the view writes booleans only. */
  hidden: boolean | string;
}

export interface TextSlot extends Shown {
  textContent: string | null;
}

export interface Control extends TextSlot {
  disabled: boolean;
}

export interface Field {
  value: string;
  disabled: boolean;
}

/** The nodes of the page the script drives; the server renders them, with their first texts (screen 01, screen 02). */
export interface PageElements {
  readonly going: Control | null;
  readonly notGoing: Control | null;
  readonly status: TextSlot;
  readonly signOut: Control;
  readonly sheet: Shown;
  readonly sheetTitle: TextSlot;
  readonly choice: Shown;
  readonly google: Control;
  readonly embeddedWarning: Shown;
  readonly emailForm: Shown;
  readonly emailTabs: Shown;
  readonly email: Field;
  readonly passwordField: Shown;
  readonly password: Field;
  readonly emailSubmit: Control;
  readonly forgot: Control;
  readonly nicknameForm: Shown;
  readonly nickname: Field;
  readonly nicknameSubmit: Control;
  readonly sheetMessage: TextSlot;
}

export interface ViewEnvironment {
  /** An in-app browser where Google refuses the sign-in: the Google button gives way to "Abra no navegador". */
  readonly embedded: boolean;
}

const SHEET_STEPS = new Set<RoundPageState["step"]>(["signIn", "signingIn", "nickname", "savingNickname"]);
const BUSY_STEPS = new Set<RoundPageState["step"]>(["starting", "signingIn", "registering", "savingNickname", "answering"]);

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

function write(slot: TextSlot, text: string | null): void {
  slot.hidden = text === null;
  slot.textContent = text ?? "";
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

function renderSheet(elements: PageElements, state: RoundPageState, environment: ViewEnvironment): void {
  const form = formOf(state);
  const busy = BUSY_STEPS.has(state.step);
  elements.sheet.hidden = !SHEET_STEPS.has(state.step);
  elements.sheetTitle.textContent = form === null ? webStrings.sheet.choice : webStrings.sheet[form];
  elements.choice.hidden = form !== "choice";
  elements.google.hidden = environment.embedded;
  elements.google.disabled = busy;
  elements.embeddedWarning.hidden = !environment.embedded;
  elements.emailForm.hidden = form !== "signIn" && form !== "signUp" && form !== "reset";
  elements.emailTabs.hidden = form === "reset";
  elements.passwordField.hidden = form === "reset";
  elements.email.disabled = busy;
  elements.password.disabled = busy;
  elements.emailSubmit.disabled = busy;
  elements.emailSubmit.textContent = webStrings.submit[form === "signUp" || form === "reset" ? form : "signIn"];
  elements.forgot.hidden = form !== "signIn";
  elements.nicknameForm.hidden = form !== "nickname";
  elements.nickname.disabled = busy;
  elements.nicknameSubmit.disabled = busy;
  write(elements.sheetMessage, sheetMessage(state));
}

/** The whole page from the state: the same state always draws the same page. */
export function renderRoundPage(elements: PageElements, state: RoundPageState, environment: ViewEnvironment): void {
  renderAnswers(elements, state);
  write(elements.status, statusText(state));
  renderSheet(elements, state, environment);
}
