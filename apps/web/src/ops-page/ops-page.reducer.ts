import type { Failure, SheetForm } from "../round-page/round-page.types";

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

function sheetReducer(state: OpsPageState, action: OpsSheetAction): OpsPageState {
  switch (action.type) {
    case "signInTapped":
      return when(state, "signIn", (step) => (step.form === null ? sheet("choice") : step));
    case "sheetClosed":
      return when(state, "signIn", () => sheet(null));
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
      return when(state, "signingIn", () => loading);
  }
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
