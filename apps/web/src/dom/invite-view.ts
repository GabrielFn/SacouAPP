import type { InvitePageState, InviteStep } from "../invite-page/invite-page.types";
import type { SheetForm } from "../round-page/round-page.types";
import { failureText, webStrings } from "../strings.pt-BR";

import {
  renderSignInSheet,
  write,
  type Control,
  type SheetElements,
  type SheetView,
  type TextSlot,
  type ViewEnvironment,
} from "./sign-in-sheet";

/** The nodes of `Web/Pages/Invite.cshtml` the script drives, and the sheet. Text through `textContent` only. */
export interface InviteElements extends SheetElements {
  readonly title: TextSlot;
  readonly detail: TextSlot;
  readonly status: TextSlot;
  readonly signIn: Control;
  readonly join: Control;
  readonly signOut: Control;
}

const BUSY_STEPS = new Set<InviteStep>(["starting", "signingIn", "previewing", "joining"]);
const SIGN_IN_STEPS = new Set<InviteStep>([
  "starting",
  "idle",
  "signIn",
  "signingIn",
  "previewing",
]);

function sheetFormOf(state: InvitePageState): SheetForm | null {
  if (state.step === "signIn") return state.form;
  if (state.step === "signingIn") return state.attempt === "google" ? "choice" : state.attempt;
  return null;
}

function sheetMessage(state: InvitePageState): string | null {
  if (state.step === "signIn") {
    if (state.failure !== null) return failureText(state.failure);
    return state.notice === "resetSent" ? webStrings.resetSent : null;
  }
  return state.step === "signingIn" ? webStrings.working : null;
}

function sheetView(state: InvitePageState): SheetView {
  const form = sheetFormOf(state);
  return {
    form,
    title:
      form === null || form === "choice" ? webStrings.invite.sheetTitle : webStrings.sheet[form],
    busy: BUSY_STEPS.has(state.step),
    message: sheetMessage(state),
  };
}

function titleOf(state: InvitePageState): string {
  switch (state.step) {
    case "preview":
    case "joining":
      return state.preview.groupName;
    case "joined":
      return state.groupName;
    case "starting":
    case "idle":
    case "signIn":
    case "signingIn":
    case "previewing":
    case "failed":
      return webStrings.invite.title;
  }
}

function detailOf(state: InvitePageState): string | null {
  if (state.step === "preview" || state.step === "joining") {
    return webStrings.invite.members(state.preview.activeMembers);
  }
  if (state.step === "joined") {
    return state.alreadyMember ? webStrings.invite.alreadyMember : webStrings.invite.joined;
  }
  return state.step === "failed" ? null : webStrings.invite.signInHint;
}

function statusOf(state: InvitePageState): string | null {
  if (state.step === "idle" || state.step === "preview") {
    return state.failure === null ? null : failureText(state.failure);
  }
  if (state.step === "failed") return failureText(state.failure);
  return state.step === "previewing" || state.step === "joining" ? webStrings.working : null;
}

function isSignedIn(state: InvitePageState): boolean {
  return (
    (state.step === "idle" && state.signedIn) || state.step === "preview" || state.step === "joined"
  );
}

/** The whole page from the state: the same state always draws the same page. */
export function renderInvitePage(
  elements: InviteElements,
  state: InvitePageState,
  environment: ViewEnvironment,
): void {
  const busy = BUSY_STEPS.has(state.step);
  elements.title.textContent = titleOf(state);
  write(elements.detail, detailOf(state));
  write(elements.status, statusOf(state));
  elements.signIn.hidden = !SIGN_IN_STEPS.has(state.step);
  elements.signIn.disabled = busy;
  elements.signIn.textContent =
    state.step === "idle" && state.signedIn ? webStrings.invite.retry : webStrings.invite.signIn;
  elements.join.hidden = state.step !== "preview" && state.step !== "joining";
  elements.join.disabled = busy;
  elements.signOut.hidden = !isSignedIn(state);
  renderSignInSheet(elements, sheetView(state), environment);
}
