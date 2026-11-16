import { useReducer, useRef } from "react";

import type { AuthResult } from "../../../services/auth/auth-session";
import { useSession } from "../../../services/auth/use-session";
import { useServices } from "../../../services/services-context";
import { authFailureText, signOutReasonText } from "../model/auth-failure-text";
import {
  initialSignInState,
  signInReducer,
  type SignInProvider,
  type SignInState,
} from "../model/sign-in.reducer";

export interface SignInScreenModel {
  readonly state: SignInState;
  readonly showsGoogle: boolean;
  readonly showsApple: boolean;
  /** The refused login, or else why the session ended (expired, deleted), or `null`. */
  readonly message: string | null;
  readonly signIn: (provider: SignInProvider) => void;
  readonly openEmail: () => void;
  readonly closeEmail: () => void;
  readonly openLink: (url: string) => void;
}

/** Screen 02: the providers of this build, one login at a time, and the text of a refusal. */
export function useSignInScreen(): SignInScreenModel {
  const { authSession, externalLink } = useServices();
  const session = useSession();
  const [state, dispatch] = useReducer(signInReducer, initialSignInState);
  // Guards the native picker against a second tap before the screen draws the pending state.
  const inFlight = useRef(false);

  function signIn(provider: SignInProvider): void {
    if (inFlight.current || state.pending !== null || state.emailOpen) return;
    inFlight.current = true;
    dispatch({ type: "started", provider });
    const login: Promise<AuthResult> =
      provider === "google" ? authSession.signInWithGoogle() : authSession.signInWithApple();
    void login.then((result) => {
      inFlight.current = false;
      dispatch(result.ok ? { type: "succeeded" } : { type: "failed", failure: result.error });
    });
  }

  return {
    state,
    showsGoogle: authSession.supports("google"),
    showsApple: authSession.supports("apple"),
    message: authFailureText(state.failure) ?? signOutReasonText(session),
    signIn,
    openEmail: () => {
      if (!inFlight.current) dispatch({ type: "email-opened" });
    },
    closeEmail: () => {
      dispatch({ type: "email-closed" });
    },
    openLink: (url) => {
      void externalLink.open(url);
    },
  };
}
