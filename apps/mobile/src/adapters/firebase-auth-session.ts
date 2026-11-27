import { err, ok, type Result } from "@sacou/volley-rules";

import type {
  AccountView,
  AuthFailure,
  AuthProvider,
  AuthResult,
  AuthSession,
  Reauthentication,
  SessionIdentity,
  SessionSnapshot,
  SignOutReason,
} from "../services/auth/auth-session";
import { firebaseFailureOf } from "./auth-failure-codes";
import type { AuthFailureReporter, AuthStage } from "./auth-failure-report";
import { createListeners } from "./listeners";

/** The token could not be renewed for lack of network; it carries nothing of the SDK's message. */
export class TokenRenewalOffline extends Error {}

/** The Firebase user as this adapter reads it: no UID, which never leaves the SDK wrapper. */
export interface FirebaseUserView {
  readonly providerIds: readonly string[];
  readonly email: string | null;
  readonly displayName: string | null;
  /** The same object for the same account (the SDK wrapper keys it by the UID, which stays there). */
  readonly identity: SessionIdentity;
  getIdToken(forceRefresh: boolean): Promise<string>;
}

export type DeleteCurrentUserOutcome = "deleted" | "other-account";

/** The few calls of `@react-native-firebase/auth` the session needs (firebase-auth-sdk.ts). */
export interface FirebaseAuthSdk {
  onAuthStateChanged(listener: (user: FirebaseUserView | null) => void): () => void;
  signInWithGoogleIdToken(idToken: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  createAccountWithEmail(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** The same account again: `auth/user-mismatch` for another one. */
  reauthenticateWithGoogleIdToken(idToken: string): Promise<void>;
  /** With the e-mail of the current user, which the SDK wrapper reads. */
  reauthenticateWithPassword(password: string): Promise<void>;
  /**
   * `user.delete()`: needs a recent login, the same 5 minutes of the API (ADR 0056, D4). Only when the
   * SDK's current user is still `identity`: it may have moved to another account before its listener
   * ran, and then nothing is deleted (`"other-account"`).
   */
  deleteCurrentUser(identity: SessionIdentity): Promise<DeleteCurrentUserOutcome>;
  /** A SHA-256 of the UID of an account seen on this phone (ADR 0067, D8), or `null`. */
  accountKeyOf(identity: SessionIdentity): Promise<string | null>;
}

/** The native Google account picker (google-sign-in.ts). */
export interface GoogleAccountPicker {
  /** The Google ID token of the chosen account, which becomes a Firebase credential. */
  pick(): Promise<Result<string, AuthFailure>>;
  /** Forgets the chosen account, so the picker shows again. */
  forget(): Promise<void>;
  /** Revokes the grant of the app to the Google account, after the account is deleted. */
  revoke(): Promise<void>;
}

export interface FirebaseAuthSessionDeps {
  readonly sdk: FirebaseAuthSdk;
  /** `null` when the build has no Google client ID: the Google button hides. */
  readonly google: GoogleAccountPicker | null;
  /** Where an unexpected failure of a sign-in stage goes (E5.2b); it never changes the result. */
  readonly failures: AuthFailureReporter;
}

const PROVIDER_IDS: readonly (readonly [string, AuthProvider])[] = [
  ["google.com", "google"],
  ["apple.com", "apple"],
  ["password", "password"],
];

function accountOf(user: FirebaseUserView): AccountView {
  const provider =
    PROVIDER_IDS.find(([id]) => user.providerIds.includes(id))?.[1] ?? ("password" as const);
  return { provider, email: user.email, displayName: user.displayName };
}

/**
 * The real `AuthSession` over the native Firebase SDK, which keeps the tokens (ADR 0057, D5). The app
 * holds only the snapshot, built from `onAuthStateChanged`, and asks for the ID token on each call.
 */
export function createFirebaseAuthSession({
  sdk,
  google,
  failures,
}: FirebaseAuthSessionDeps): AuthSession {
  const listeners = createListeners();
  const snapshot: { value: SessionSnapshot } = { value: { status: "unknown" } };
  const currentUser: { value: FirebaseUserView | null } = { value: null };
  const pendingReason: { value: SignOutReason | null } = { value: null };
  const ready: { current: () => void } = { current: () => undefined };
  const firstState = new Promise<void>((resolve) => {
    ready.current = resolve;
  });

  /** Asked by `signOut`, or else fallen elsewhere while signed in (`expired`), or never open. */
  function reasonOfSignOut(): SignOutReason | null {
    const reason = pendingReason.value ?? (snapshot.value.status === "signedIn" ? "expired" : null);
    pendingReason.value = null;
    return reason;
  }

  async function attempt(stage: AuthStage, action: () => Promise<void>): Promise<AuthResult> {
    try {
      await action();
      return ok(null);
    } catch (error) {
      const failure = firebaseFailureOf(error);
      failures.report({ stage, failure, thrown: { error } });
      return err(failure);
    }
  }

  sdk.onAuthStateChanged((user) => {
    snapshot.value =
      user === null
        ? { status: "signedOut", reason: reasonOfSignOut() }
        : { status: "signedIn", account: accountOf(user) };
    currentUser.value = user;
    ready.current();
    listeners.notify();
  });

  async function reauthenticateWith(proof: Reauthentication): Promise<AuthResult> {
    if (proof.provider === "password") {
      return attempt("firebase-reauth-password", () =>
        sdk.reauthenticateWithPassword(proof.password),
      );
    }
    if (proof.provider === "apple" || google === null) return err("provider-unavailable");
    const picked = await google.pick();
    if (!picked.ok) return picked;
    return attempt("firebase-reauth-google", () =>
      sdk.reauthenticateWithGoogleIdToken(picked.value),
    );
  }

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => snapshot.value,
    supports: (provider) => (provider === "google" ? google !== null : provider === "password"),
    async signInWithGoogle() {
      if (google === null) return err("provider-unavailable");
      const picked = await google.pick();
      if (!picked.ok) return picked;
      return attempt("firebase-google-credential", () => sdk.signInWithGoogleIdToken(picked.value));
    },
    // Only Android in the pilot (question 58): the port keeps the provider for the iOS app.
    signInWithApple: () => Promise.resolve(err("provider-unavailable")),
    signInWithEmail: (email, password) =>
      attempt("firebase-email-sign-in", () => sdk.signInWithEmail(email, password)),
    createAccountWithEmail: (email, password) =>
      attempt("firebase-email-sign-up", () => sdk.createAccountWithEmail(email, password)),
    sendPasswordReset: (email) =>
      attempt("firebase-password-reset", () => sdk.sendPasswordReset(email)),
    currentSession: () => currentUser.value?.identity ?? null,
    accountKeyOf: (session) => sdk.accountKeyOf(session),
    async getIdToken({ forceRefresh }) {
      await firstState;
      const user = currentUser.value;
      if (user === null) return null;
      try {
        return await user.getIdToken(forceRefresh);
      } catch (error) {
        // Only no network rejects, and the API client treats it as `offline`. Any other refusal of the
        // SDK (token revoked, user disabled or deleted) is a session that is over: `null` ends it.
        if (firebaseFailureOf(error) === "offline") throw new TokenRenewalOffline();
        return null;
      }
    },
    async signOut(reason) {
      pendingReason.value = reason;
      try {
        await sdk.signOut();
      } catch {
        // Nobody was signed in: nothing to end in the SDK.
        pendingReason.value = null;
      }
    },
    async forgetProviderAccount() {
      try {
        await google?.forget();
      } catch {
        // The picker had no account: nothing to forget.
      }
    },
    async reauthenticate(proof) {
      const result = await reauthenticateWith(proof);
      // A new ID token now, so the next call to the API carries the new `auth_time`.
      if (result.ok) await currentUser.value?.getIdToken(true).catch(() => null);
      return result;
    },
    async deleteAccount(session) {
      // A late 410 of another account: the one signed in now is not touched.
      if (currentUser.value?.identity !== session) return;
      pendingReason.value = "deleted";
      try {
        if ((await sdk.deleteCurrentUser(session)) === "other-account") {
          // The SDK had already moved to another account, before its listener: nothing is touched.
          pendingReason.value = null;
          return;
        }
      } catch {
        // Refused (no recent login, no network): the session ends anyway, and the 410 of the next login
        // asks again (ADR 0056, question 63).
        await sdk.signOut().catch(() => {
          pendingReason.value = null;
        });
      }
      await google?.revoke().catch(() => null);
    },
  };
}
