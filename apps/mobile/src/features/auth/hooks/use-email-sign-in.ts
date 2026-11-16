import { useReducer } from "react";

import type { AuthResult } from "../../../services/auth/auth-session";
import { useServices } from "../../../services/services-context";
import {
  emailSignInReducer,
  initialEmailSignInState,
  type EmailMode,
  type EmailSignInState,
} from "../model/email-sign-in.reducer";
import { canSubmit, normalizedEmail } from "../model/email-sign-in.selectors";

export interface EmailSignInModel {
  readonly state: EmailSignInState;
  readonly changeMode: (mode: EmailMode) => void;
  readonly changeEmail: (text: string) => void;
  readonly changePassword: (text: string) => void;
  readonly submit: () => void;
  /** Forgets the password, then closes the sheet. */
  readonly close: () => void;
}

/** The e-mail sheet: sign in, create the account or ask for the reset link. */
export function useEmailSignIn(onClose: () => void): EmailSignInModel {
  const { authSession } = useServices();
  const [state, dispatch] = useReducer(emailSignInReducer, initialEmailSignInState);

  function request(): Promise<AuthResult> {
    const email = normalizedEmail(state);
    switch (state.mode) {
      case "signIn":
        return authSession.signInWithEmail(email, state.password);
      case "signUp":
        return authSession.createAccountWithEmail(email, state.password);
      case "reset":
        return authSession.sendPasswordReset(email);
    }
  }

  function submit(): void {
    if (!canSubmit(state)) return;
    const { mode } = state;
    dispatch({ type: "submitted" });
    void request().then((result) => {
      if (!result.ok) dispatch({ type: "failed", failure: result.error });
      else if (mode === "reset") dispatch({ type: "reset-sent" });
      // A login that worked swaps the screen through the session gate: nothing to do here.
    });
  }

  return {
    state,
    changeMode: (mode) => {
      dispatch({ type: "mode-changed", mode });
    },
    changeEmail: (text) => {
      dispatch({ type: "email-changed", text });
    },
    changePassword: (text) => {
      dispatch({ type: "password-changed", text });
    },
    submit,
    close: () => {
      dispatch({ type: "closed" });
      onClose();
    },
  };
}
