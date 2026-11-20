import type { Failure, FailureKind, SheetForm } from "../round-page/round-page.types";

import {
  isInviteJoinAction,
  isInviteSessionAction,
  type InviteJoinAction,
  type InvitePageAction,
  type InviteSessionAction,
  type InviteSheetAction,
} from "./invite-page.actions";
import type { InvitePageState, InvitePreview } from "./invite-page.types";

export const initialInvitePageState: InvitePageState = { step: "starting" };

/** Failures after which the link leads nowhere for this person: no button to try again (ADR 0040, D10). */
const DEAD_ENDS: ReadonlySet<FailureKind> = new Set<FailureKind>([
  "inviteInvalid",
  "linkInvalid",
  "removed",
  "groupFull",
]);

const linkInvalid: InvitePageState = { step: "failed", failure: { kind: "inviteInvalid" } };

function idle(signedIn: boolean, failure: Failure | null = null): InvitePageState {
  return { step: "idle", signedIn, failure };
}

function sheet(form: SheetForm, failure: Failure | null = null): InvitePageState {
  return { step: "signIn", form, failure, notice: null };
}

function when<S extends InvitePageState["step"]>(
  state: InvitePageState,
  step: S,
  change: (current: Extract<InvitePageState, { step: S }>) => InvitePageState,
): InvitePageState {
  return state.step === step ? change(state as Extract<InvitePageState, { step: S }>) : state;
}

function sessionReducer(state: InvitePageState, action: InviteSessionAction): InvitePageState {
  switch (action.type) {
    case "tokenRejected":
      return when(state, "starting", () => linkInvalid);
    case "sessionChecked":
      return when(state, "starting", () =>
        action.signedIn ? { step: "previewing" } : idle(false),
      );
    case "signedOut":
      return state.step === "failed" ? state : idle(false);
  }
}

function afterTap(state: InvitePageState): InvitePageState {
  if (state.step !== "idle") return state;
  return state.signedIn ? { step: "previewing" } : sheet("choice");
}

function sheetReducer(state: InvitePageState, action: InviteSheetAction): InvitePageState {
  switch (action.type) {
    case "signInTapped":
      return afterTap(state);
    case "sheetClosed":
      return when(state, "signIn", () => idle(false));
    case "formChosen":
      return when(state, "signIn", () => sheet(action.form));
    case "signInStarted":
      return when(state, "signIn", () => ({ step: "signingIn", attempt: action.attempt }));
    case "signInFailed":
      return when(state, "signingIn", (step) =>
        sheet(step.attempt === "google" ? "choice" : step.attempt, action.failure),
      );
    case "signInCancelled":
      return when(state, "signingIn", (step) =>
        sheet(step.attempt === "google" ? "choice" : step.attempt),
      );
    case "resetSent":
      return when(state, "signingIn", () => ({ ...sheet("signIn"), notice: "resetSent" }));
    case "signedIn":
      return when(state, "signingIn", () => ({ step: "previewing" }));
  }
}

/** Who is in already sees it at once: nothing to join (the accept would answer 200 without counting a use). */
function afterPreview(preview: InvitePreview): InvitePageState {
  return preview.alreadyMember
    ? { step: "joined", groupName: preview.groupName, alreadyMember: true }
    : { step: "preview", preview, failure: null };
}

/** A dead link ends the flow; a deleted account leaves the session; the rest can be tried again. */
function afterPreviewFailure(failure: Failure): InvitePageState {
  if (DEAD_ENDS.has(failure.kind)) return { step: "failed", failure };
  return idle(failure.kind !== "accountDeleted", failure);
}

function joinReducer(state: InvitePageState, action: InviteJoinAction): InvitePageState {
  switch (action.type) {
    case "previewLoaded":
      return when(state, "previewing", () => afterPreview(action.preview));
    case "previewFailed":
      return when(state, "previewing", () => afterPreviewFailure(action.failure));
    case "joinTapped":
      return when(state, "preview", (step) => ({ step: "joining", preview: step.preview }));
    case "joined":
      return when(state, "joining", (step) => ({
        step: "joined",
        groupName: step.preview.groupName,
        alreadyMember: false,
      }));
    case "joinFailed":
      return when(state, "joining", (step) =>
        DEAD_ENDS.has(action.failure.kind) || action.failure.kind === "accountDeleted"
          ? { step: "failed", failure: action.failure }
          : { step: "preview", preview: step.preview, failure: action.failure },
      );
  }
}

/**
 * The invite page's flow, pure: no Firebase, no fetch, no DOM, and never the token. An action that does not fit the
 * current step leaves the state as it is, so a late answer of a stale request changes nothing.
 */
export function invitePageReducer(
  state: InvitePageState,
  action: InvitePageAction,
): InvitePageState {
  if (isInviteSessionAction(action)) return sessionReducer(state, action);
  if (isInviteJoinAction(action)) return joinReducer(state, action);
  return sheetReducer(state, action);
}
