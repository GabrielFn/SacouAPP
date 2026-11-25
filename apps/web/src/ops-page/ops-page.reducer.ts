import type { Failure, SheetForm, SignInAttempt } from "../round-page/round-page.types";

import {
  isOpsLoadAction,
  isOpsSessionAction,
  type OpsLoadAction,
  type OpsPageAction,
  type OpsSessionAction,
  type OpsSheetAction,
} from "./ops-page.actions";
import type { OpsPageState } from "./ops-page.types";

export const initialOpsPageState: OpsPageState = { step: "starting" };

type SignInStep = Extract<OpsPageState, { step: "signIn" }>;
type SigningInStep = Extract<OpsPageState, { step: "signingIn" }>;

const loading: OpsPageState = { step: "loading" };

function sheet(form: SheetForm | null, failure: Failure | null = null): OpsPageState {
  return { step: "signIn", form, failure, notice: null };
}

function when<S extends OpsPageState["step"]>(
  state: OpsPageState,
  step: S,
  change: (current: Extract<OpsPageState, { step: S }>) => OpsPageState,
): OpsPageState {
  return state.step === step ? change(state as Extract<OpsPageState, { step: S }>) : state;
}

function sessionReducer(state: OpsPageState, action: OpsSessionAction): OpsPageState {
  switch (action.type) {
    case "sessionChecked":
      return when(state, "starting", () => (action.signedIn ? loading : sheet("choice")));
    case "signedOut":
      return sheet("choice");
  }
}

/** The form a Firebase attempt came from: the Google window goes back to the two ways in. */
function formOf(attempt: SignInAttempt): SheetForm {
  return attempt === "google" ? "choice" : attempt;
}

/** What the person does on the open sheet (or the closed one, with ENTRAR). */
function openSheet(step: SignInStep, action: OpsSheetAction): OpsPageState {
  switch (action.type) {
    case "signInStarted":
      return { step: "signingIn", attempt: action.attempt };
    case "formChosen":
      return sheet(action.form);
    case "sheetClosed":
      return sheet(null);
    case "signInTapped":
      return step.form === null ? sheet("choice") : step;
    case "signInFailed":
    case "signInCancelled":
    case "resetSent":
    case "signedIn":
      return step;
  }
}

/** What Firebase answered to the attempt. */
function attempted(step: SigningInStep, action: OpsSheetAction): OpsPageState {
  switch (action.type) {
    case "signedIn":
      return loading;
    case "signInFailed":
      return sheet(formOf(step.attempt), action.failure);
    case "signInCancelled":
      return sheet(formOf(step.attempt));
    case "resetSent":
      return { step: "signIn", form: "signIn", failure: null, notice: "resetSent" };
    case "signInStarted":
    case "formChosen":
    case "sheetClosed":
    case "signInTapped":
      return step;
  }
}

function sheetReducer(state: OpsPageState, action: OpsSheetAction): OpsPageState {
  if (state.step === "signIn") return openSheet(state, action);
  return state.step === "signingIn" ? attempted(state, action) : state;
}

function loadReducer(state: OpsPageState, action: OpsLoadAction): OpsPageState {
  switch (action.type) {
    case "loaded":
      return when(state, "loading", () => ({ step: "ready", metrics: action.metrics }));
    case "denied":
      return when(state, "loading", () => ({ step: "denied" }));
    case "unauthorized":
      return when(state, "loading", () => sheet("choice"));
    case "loadFailed":
      return when(state, "loading", () => ({ step: "failed", failure: action.failure }));
    case "reloadTapped":
      return state.step === "ready" || state.step === "failed" ? loading : state;
  }
}

/**
 * The dashboard's flow, pure: no Firebase, no fetch, no DOM. An action that does not fit the current step leaves the
 * state as it is, so a late answer changes nothing; leaving the session always drops the numbers.
 */
export function opsPageReducer(state: OpsPageState, action: OpsPageAction): OpsPageState {
  if (isOpsSessionAction(action)) return sessionReducer(state, action);
  if (isOpsLoadAction(action)) return loadReducer(state, action);
  return sheetReducer(state, action);
}
