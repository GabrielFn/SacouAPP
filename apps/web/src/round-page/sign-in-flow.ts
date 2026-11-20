import type { AuthOutcome, AuthPort } from "./ports";
import type { EmailMode, Failure, SheetForm, SignInAttempt } from "./round-page.types";

/** The sheet of screen 02, the same on the round page and on the invite page: the two ways in and the e-mail form. */
export type SignInSheetAction =
  | { readonly type: "sheetClosed" }
  | { readonly type: "formChosen"; readonly form: SheetForm }
  | { readonly type: "signInStarted"; readonly attempt: SignInAttempt }
  | { readonly type: "signInFailed"; readonly failure: Failure }
  /** The person closed the Google window: back to the sheet, with nothing to explain. */
  | { readonly type: "signInCancelled" }
  | { readonly type: "resetSent" }
  | { readonly type: "signedIn" };

export type SignInDispatch = (action: SignInSheetAction) => Promise<void>;

/** What a Firebase call ends in, as an action. A blocked window is each page's own failure. */
export function settleSignIn(
  outcome: AuthOutcome,
  dispatch: SignInDispatch,
  popupBlocked: Failure,
): Promise<void> {
  switch (outcome.kind) {
    case "done":
      return dispatch({ type: "signedIn" });
    case "cancelled":
      return dispatch({ type: "signInCancelled" });
    case "failed":
      return dispatch({ type: "signInFailed", failure: outcome.failure });
    case "popupBlocked":
      return dispatch({ type: "signInFailed", failure: popupBlocked });
  }
}

/** The mode of the open e-mail form, or null when the sheet shows something else. */
export function emailModeOf(state: {
  readonly step: string;
  readonly form?: SheetForm;
}): EmailMode | null {
  return state.step === "signIn" && state.form !== undefined && state.form !== "choice"
    ? state.form
    : null;
}

/**
 * The e-mail form: enter, make an account, or send the reset link (the same answer for an unknown e-mail). Nothing
 * when the form is not open (`mode` null).
 */
export async function submitEmailForm(
  auth: AuthPort,
  mode: EmailMode | null,
  email: string,
  password: string,
  dispatch: SignInDispatch,
  popupBlocked: Failure,
): Promise<void> {
  if (mode === null) return;
  await dispatch({ type: "signInStarted", attempt: mode });
  if (mode === "reset") {
    const sent = await auth.sendPasswordReset(email);
    return sent.kind === "done"
      ? dispatch({ type: "resetSent" })
      : settleSignIn(sent, dispatch, popupBlocked);
  }
  const outcome =
    mode === "signIn"
      ? await auth.signInWithEmail(email, password)
      : await auth.signUpWithEmail(email, password);
  return settleSignIn(outcome, dispatch, popupBlocked);
}
