import { failureText, standingText, webStrings, type DropInContext } from "../strings.pt-BR";
import type { RoundPageState, SheetForm, Standing } from "../round-page/round-page.types";
import { holdsPlace } from "../round-page/standing";

import {
  renderSignInSheet,
  write,
  type Control,
  type Shown,
  type SheetElements,
  type TextSlot,
  type ViewEnvironment,
} from "./sign-in-sheet";

export type { Control, Field, Shown, TextSlot, ViewEnvironment } from "./sign-in-sheet";

/** What the round page's view needs beyond the sheet's: the avulsos' window the server wrote on the page (R101). */
export interface RoundViewEnvironment extends ViewEnvironment {
  readonly dropIn: DropInContext;
}

/** The nodes of the page the script drives; the server renders them, with their first texts (screen 01, screen 02). */
export interface PageElements extends SheetElements {
  readonly going: Control | null;
  readonly notGoing: Control | null;
  /** "Sair da lista?" (R101, item 3b): rendered by the server, hidden until "NÃO VOU MAIS" asks. */
  readonly leaveConfirm: Shown | null;
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

const NICKNAME_STEPS = new Set<RoundPageState["step"]>(["nickname", "savingNickname"]);

function formOf(state: RoundPageState): SheetForm | "nickname" | null {
  if (state.step === "signIn") return state.form;
  if (state.step === "signingIn") return state.attempt === "google" ? "choice" : state.attempt;
  return NICKNAME_STEPS.has(state.step) ? "nickname" : null;
}

function statusText(state: RoundPageState, dropIn: DropInContext): string | null {
  if (state.step === "idle") {
    if (state.failure !== null) return failureText(state.failure, dropIn);
    return state.standing === null ? null : standingText(state.standing);
  }
  return state.step === "registering" || state.step === "answering" ? webStrings.working : null;
}

function sheetMessage(state: RoundPageState, dropIn: DropInContext): string | null {
  if (state.step === "signIn") {
    if (state.failure !== null) return failureText(state.failure, dropIn);
    return state.notice === "resetSent" ? webStrings.resetSent : null;
  }
  if (state.step === "nickname" && state.failure !== null) {
    return failureText(state.failure, dropIn);
  }
  return BUSY_STEPS.has(state.step) && SHEET_STEPS.has(state.step) ? webStrings.working : null;
}

/** After the server refused the avulso for the window, VOU stays off: tapping it again would only be refused again. */
function windowRefused(state: RoundPageState): boolean {
  return state.step === "idle" && state.failure?.kind === "dropInWindowClosed";
}

const STANDING_STEPS = new Set<RoundPageState["step"]>(["idle", "answering", "confirmingLeave"]);

function standingOf(state: RoundPageState): Standing | null {
  return STANDING_STEPS.has(state.step) && "standing" in state ? state.standing : null;
}

function renderAnswers(elements: PageElements, state: RoundPageState): void {
  const busy = BUSY_STEPS.has(state.step);
  const confirming = state.step === "confirmingLeave";
  const standing = standingOf(state);
  const placed = holdsPlace(standing);
  if (elements.going !== null) {
    elements.going.disabled = busy || windowRefused(state);
    elements.going.hidden = placed || confirming;
  }
  if (elements.notGoing !== null) {
    elements.notGoing.disabled = busy;
    elements.notGoing.hidden = standing?.status === "notGoing" || confirming;
    elements.notGoing.textContent = placed ? webStrings.notGoingAnymore : webStrings.notGoingLabel;
  }
  if (elements.leaveConfirm !== null) elements.leaveConfirm.hidden = !confirming;
  elements.signOut.hidden = !(state.step === "idle" && state.signedIn);
}

function renderSheet(
  elements: PageElements,
  state: RoundPageState,
  environment: RoundViewEnvironment,
): void {
  const form = formOf(state);
  renderSignInSheet(
    elements,
    {
      form,
      title: form === null ? webStrings.sheet.choice : webStrings.sheet[form],
      busy: BUSY_STEPS.has(state.step),
      message: sheetMessage(state, environment.dropIn),
    },
    environment,
  );
}

/** The whole page from the state: the same state always draws the same page. */
export function renderRoundPage(
  elements: PageElements,
  state: RoundPageState,
  environment: RoundViewEnvironment,
): void {
  renderAnswers(elements, state);
  write(elements.status, statusText(state, environment.dropIn));
  renderSheet(elements, state, environment);
}
