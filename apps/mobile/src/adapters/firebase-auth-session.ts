import { err, ok, type Result } from "@sacou/volley-rules";

import type {
  AccountView,
  AuthFailure,
  AuthProvider,
  AuthResult,
  AuthSession,
  SessionSnapshot,
  SignOutReason,
} from "../services/auth/auth-session";
import { firebaseFailureOf } from "./auth-failure-codes";
import { createListeners } from "./listeners";

/** The Firebase user as this adapter reads it: no UID, which never leaves the SDK wrapper. */
export interface FirebaseUserView {
  readonly providerIds: readonly string[];
  readonly email: string | null;
  readonly displayName: string | null;
  getIdToken(forceRefresh: boolean): Promise<string>;
}

/** The few calls of `@react-native-firebase/auth` the session needs (firebase-auth-sdk.ts). */
export interface FirebaseAuthSdk {
  onAuthStateChanged(listener: (user: FirebaseUserView | null) => void): () => void;
  signInWithGoogleIdToken(idToken: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  createAccountWithEmail(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

/** The native Google account picker (google-sign-in.ts). */
export interface GoogleAccountPicker {
  /** The Google ID token of the chosen account, which becomes a Firebase credential. */
  pick(): Promise<Result<string, AuthFailure>>;
  /** Forgets the chosen account, so the picker shows again. */
  forget(): Promise<void>;
}

export interface FirebaseAuthSessionDeps {
  readonly sdk: FirebaseAuthSdk;
  /** `null` when the build has no Google client ID: the Google button hides. */
  readonly google: GoogleAccountPicker | null;
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

async function attempt(action: () => Promise<void>): Promise<AuthResult> {
  try {
    await action();
    return ok(null);
  } catch (error) {
    return err(firebaseFailureOf(error));
  }
}

/**
 * The real `AuthSession` over the native Firebase SDK, which keeps the tokens (ADR 0057, D5). The app
 * holds only the snapshot, built from `onAuthStateChanged`, and asks for the ID token on each call.
 */
export function createFirebaseAuthSession({ sdk, google }: FirebaseAuthSessionDeps): AuthSession {
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

  sdk.onAuthStateChanged((user) => {
    snapshot.value =
      user === null
        ? { status: "signedOut", reason: reasonOfSignOut() }
        : { status: "signedIn", account: accountOf(user) };
    currentUser.value = user;
    ready.current();
    listeners.notify();
  });

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => snapshot.value,
    supports: (provider) => (provider === "google" ? google !== null : provider === "password"),
    async signInWithGoogle() {
      if (google === null) return err("provider-unavailable");
      const picked = await google.pick();
      if (!picked.ok) return picked;
      return attempt(() => sdk.signInWithGoogleIdToken(picked.value));
    },
    // Only Android in the pilot (question 58): the port keeps the provider for the iOS app.
    signInWithApple: () => Promise.resolve(err("provider-unavailable")),
    signInWithEmail: (email, password) => attempt(() => sdk.signInWithEmail(email, password)),
    createAccountWithEmail: (email, password) =>
      attempt(() => sdk.createAccountWithEmail(email, password)),
    sendPasswordReset: (email) => attempt(() => sdk.sendPasswordReset(email)),
    async getIdToken({ forceRefresh }) {
      await firstState;
      const user = currentUser.value;
      // A failed renewal rejects: the API client treats it as no network, not as a session over.
      return user === null ? null : user.getIdToken(forceRefresh);
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
  };
}
