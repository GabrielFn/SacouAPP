import type { Result } from "@sacou/volley-rules";

/** How the person signed in. Apple is in the port for the iOS app, after the pilot (question 58). */
export type AuthProvider = "google" | "apple" | "password";

/**
 * What the phone knows of the account, for the screens only (login, account). It has no UID: the
 * UID never leaves the adapter, and the app points to `MemberId` (ADR 0057, D2).
 */
export interface AccountView {
  readonly provider: AuthProvider;
  readonly email: string | null;
  readonly displayName: string | null;
}

/**
 * Which account a session belongs to, without the UID (ADR 0057, D2): the same object for the same
 * account, compared by reference. It ties a late answer of the API (a 410) to the account that sent it.
 */
export interface SessionIdentity {
  readonly opaque: symbol;
}

/** Why the session ended, shown once on the login screen. `null`: it was never open on this phone. */
export type SignOutReason = "signedOut" | "expired" | "deleted";

export type SessionSnapshot =
  | { readonly status: "unknown" }
  | { readonly status: "signedOut"; readonly reason: SignOutReason | null }
  | { readonly status: "signedIn"; readonly account: AccountView };

/**
 * Every way a login can fail, as a closed union. The raw message of the SDK never leaves the adapter,
 * because it may carry the e-mail (ADR 0057, D2).
 */
export type AuthFailure =
  | "cancelled"
  | "offline"
  | "invalid-credentials"
  | "email-unavailable"
  | "weak-password"
  | "too-many-requests"
  | "provider-unavailable"
  | "unexpected";

export type AuthResult = Result<null, AuthFailure>;

/**
 * The login asked again before deleting the account, by the provider of the session (ADR 0056, D4):
 * Google opens the picker again; an e-mail account gives its password on the screen 30b.
 */
export type Reauthentication =
  | { readonly provider: "google" | "apple" }
  | { readonly provider: "password"; readonly password: string };

/**
 * The session of the person on this phone. Its state lives only in the SDK, which keeps the tokens in
 * the private area of the app (ADR 0057, D5): the app reads it here and never copies it.
 */
export interface AuthSession {
  /** For `useSyncExternalStore`: the listener is called whenever `snapshot()` changes. */
  subscribe(listener: () => void): () => void;
  /** The same object until the session changes. */
  snapshot(): SessionSnapshot;
  /** Whether this build can offer the provider (Google needs its client ID; Apple needs iOS). */
  supports(provider: AuthProvider): boolean;
  signInWithGoogle(): Promise<AuthResult>;
  signInWithApple(): Promise<AuthResult>;
  signInWithEmail(email: string, password: string): Promise<AuthResult>;
  createAccountWithEmail(email: string, password: string): Promise<AuthResult>;
  /** Asks the provider for the reset e-mail. The screen answers the same text either way (D7). */
  sendPasswordReset(email: string): Promise<AuthResult>;
  /** The account signed in now; `null` when nobody is (or the SDK has not answered yet). */
  currentSession(): SessionIdentity | null;
  /**
   * The key of the account of `session` that the court log keeps as the owner of a session (ADR 0067,
   * D8): a hash made in the adapter, never the UID. The same account always gives the same key.
   */
  accountKeyOf(session: SessionIdentity): Promise<string | null>;
  /** `null` when nobody is signed in; `forceRefresh` asks the SDK for a new token. */
  getIdToken(options: { readonly forceRefresh: boolean }): Promise<string | null>;
  /** Ends the session in the SDK: from here on `getIdToken` gives `null`. */
  signOut(reason: SignOutReason): Promise<void>;
  /** Forgets the account chosen in the Google picker, so the next login asks again (account switch). */
  forgetProviderAccount(): Promise<void>;
  /** A fresh login of the same account, for the API's `identity.recent-login-required`. */
  reauthenticate(proof: Reauthentication): Promise<AuthResult>;
  /**
   * After the API deleted the account (204, or 410 on a later login): deletes the user in Firebase, revokes
   * the Google grant and ends the session as `deleted`. If the SDK refuses, it signs out anyway, and the
   * 410 of the next login tries again (ADR 0056, question 63). Only for the account of `session`: if
   * another account is signed in now (a late 410 after an account switch), it does nothing.
   */
  deleteAccount(session: SessionIdentity): Promise<void>;
}
