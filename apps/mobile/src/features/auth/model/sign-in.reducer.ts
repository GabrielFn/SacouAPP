import type { AuthFailure } from "../../../services/auth/auth-session";

/** The providers of the buttons of screen 02; the e-mail has its own sheet and reducer. */
export type SignInProvider = "google" | "apple";

/**
 * The local state of screen 02 (frontend.md, rule 4). With a login pending, every way in is off, so a
 * double tap never opens two pickers.
 */
export interface SignInState {
  readonly pending: SignInProvider | null;
  /** `null` also after a cancel: closing the picker is not an error. */
  readonly failure: AuthFailure | null;
  readonly emailOpen: boolean;
}

export type SignInAction =
  | { readonly type: "started"; readonly provider: SignInProvider }
  | { readonly type: "failed"; readonly failure: AuthFailure }
  | { readonly type: "succeeded" }
  | { readonly type: "dismissed" }
  | { readonly type: "email-opened" }
  | { readonly type: "email-closed" };

export const initialSignInState: SignInState = { pending: null, failure: null, emailOpen: false };

function isBusy(state: SignInState): boolean {
  return state.pending !== null || state.emailOpen;
}

export function signInReducer(state: SignInState, action: SignInAction): SignInState {
  switch (action.type) {
    case "started":
      return isBusy(state) ? state : { ...state, pending: action.provider, failure: null };
    case "failed":
      return {
        ...state,
        pending: null,
        failure: action.failure === "cancelled" ? null : action.failure,
      };
    case "succeeded":
      return { ...state, pending: null, failure: null };
    case "dismissed":
      return { ...state, failure: null };
    case "email-opened":
      return isBusy(state) ? state : { ...state, emailOpen: true, failure: null };
    case "email-closed":
      return { ...state, emailOpen: false };
  }
}
