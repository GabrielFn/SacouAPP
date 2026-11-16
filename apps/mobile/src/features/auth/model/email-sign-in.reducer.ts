import type { AuthFailure } from "../../../services/auth/auth-session";

export type EmailMode = "signIn" | "signUp" | "reset";

/**
 * The local state of the e-mail sheet. The password lives only here: never in a store, the cache or a
 * log, and it is cleared when the mode changes, after a refused credential and when the sheet closes
 * (ADR 0057, D5).
 */
export interface EmailSignInState {
  readonly mode: EmailMode;
  readonly email: string;
  readonly password: string;
  readonly submitting: boolean;
  readonly failure: AuthFailure | null;
  readonly resetSent: boolean;
}

export type EmailSignInAction =
  | { readonly type: "mode-changed"; readonly mode: EmailMode }
  | { readonly type: "email-changed"; readonly text: string }
  | { readonly type: "password-changed"; readonly text: string }
  | { readonly type: "submitted" }
  /** `mode`: the mode the request was sent in. An answer for another mode is ignored. */
  | { readonly type: "failed"; readonly mode: EmailMode; readonly failure: AuthFailure }
  | { readonly type: "reset-sent"; readonly mode: EmailMode }
  | { readonly type: "closed" };

export const initialEmailSignInState: EmailSignInState = {
  mode: "signIn",
  email: "",
  password: "",
  submitting: false,
  failure: null,
  resetSent: false,
};

/** Refusals that speak of the password: it is typed again from scratch. */
const CLEARS_PASSWORD: ReadonlySet<AuthFailure> = new Set([
  "invalid-credentials",
  "email-unavailable",
  "weak-password",
]);

function failed(state: EmailSignInState, failure: AuthFailure): EmailSignInState {
  // The reset answers the same for an unknown e-mail as for a known one (no account oracle, D7).
  if (state.mode === "reset" && failure === "invalid-credentials") {
    return { ...state, submitting: false, failure: null, resetSent: true };
  }
  return {
    ...state,
    submitting: false,
    failure: failure === "cancelled" ? null : failure,
    password: CLEARS_PASSWORD.has(failure) ? "" : state.password,
  };
}

export function emailSignInReducer(
  state: EmailSignInState,
  action: EmailSignInAction,
): EmailSignInState {
  switch (action.type) {
    case "mode-changed":
      // While a request is out the mode stays, so its answer lands where it was asked.
      return state.submitting
        ? state
        : { ...initialEmailSignInState, mode: action.mode, email: state.email };
    case "email-changed":
      return { ...state, email: action.text, failure: null, resetSent: false };
    case "password-changed":
      return { ...state, password: action.text, failure: null };
    case "submitted":
      return state.submitting ? state : { ...state, submitting: true, failure: null };
    case "failed":
      return action.mode === state.mode ? failed(state, action.failure) : state;
    case "reset-sent":
      return action.mode === state.mode ? { ...state, submitting: false, resetSent: true } : state;
    case "closed":
      return initialEmailSignInState;
  }
}
