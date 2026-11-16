import type { QueryClient } from "@tanstack/react-query";

import type { IdTokenProvider } from "../api/id-token-provider";
import type { AuthSession, SessionIdentity, SignOutReason } from "../auth/auth-session";
import { clearSession, type SessionStores } from "./clear-session";

export interface SessionEnderDeps {
  readonly authSession: AuthSession;
  readonly queries: Pick<QueryClient, "cancelQueries">;
  readonly stores: SessionStores;
}

/** The one way out of a session: the Sair button, the expired session and a session ended elsewhere. */
export interface SessionEnder {
  /** Signs out and forgets everything of the account on this phone. Calls at the same time share one. */
  end(reason: Exclude<SignOutReason, "deleted">): Promise<void>;
  /**
   * The API deleted the account of `session` (204 of screen 30b, or 410 of a later login): deletes it in
   * Firebase too and forgets it, like `end`. Nothing when another account is signed in now: a late answer
   * of the old account never deletes nor ends the session of the new one.
   */
  endDeleted(session: SessionIdentity): Promise<void>;
  /**
   * The SDK is already signed out (the app opened that way, or the session fell elsewhere): forgets the
   * account on this phone. Once per signed-out period, so the gate can call it on every render.
   */
  cleanUp(): Promise<void>;
}

/**
 * The order is the defense (ADR 0057, D4): the SDK first, so that no call leaves with the token; then the
 * calls in flight are cancelled, so none writes the cache again; then the cache, the invite links and,
 * last, the account of the Google picker, so the next login asks which account.
 */
export function createSessionEnder({
  authSession,
  queries,
  stores,
}: SessionEnderDeps): SessionEnder {
  const running: { current: Promise<void> | null } = { current: null };
  const cleaned = { value: false };
  authSession.subscribe(() => {
    if (authSession.snapshot().status === "signedIn") cleaned.value = false;
  });

  async function forget(): Promise<void> {
    await queries.cancelQueries();
    await clearSession(stores);
    await authSession.forgetProviderAccount();
    cleaned.value = true;
  }

  function once(steps: () => Promise<void>): Promise<void> {
    running.current ??= steps().finally(() => {
      running.current = null;
    });
    return running.current;
  }

  return {
    end(reason) {
      if (running.current !== null) return running.current;
      if (authSession.snapshot().status === "signedOut") return Promise.resolve();
      return once(async () => {
        await authSession.signOut(reason);
        await forget();
      });
    },
    endDeleted(session) {
      if (running.current !== null) return running.current;
      if (authSession.currentSession() !== session) return Promise.resolve();
      return once(async () => {
        // A deleted account leaves Firebase too; signing out is part of it (ADR 0056, question 63).
        await authSession.deleteAccount(session);
        await forget();
      });
    },
    cleanUp() {
      if (running.current !== null) return running.current;
      if (cleaned.value) return Promise.resolve();
      return once(forget);
    },
  };
}

/** What the API client gets: the token of the session, and the expired session ends through the ender. */
export function sessionIdTokens(authSession: AuthSession, ender: SessionEnder): IdTokenProvider {
  return {
    currentSession: () => authSession.currentSession(),
    getIdToken: (options) => authSession.getIdToken(options),
    onSessionExpired: () => {
      void ender.end("expired");
    },
    onAccountDeleted: (session) => {
      void ender.endDeleted(session);
    },
  };
}
