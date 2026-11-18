import { err, ok } from "@sacou/volley-rules";

import type {
  AccountView,
  AuthFailure,
  AuthProvider,
  AuthResult,
  AuthSession,
  SessionIdentity,
  SessionSnapshot,
  SignOutReason,
} from "../services/auth/auth-session";
import { createListeners } from "./listeners";

export const FAKE_SESSION_TOKEN = "fake-session-token-Hq4";

export type FakeAuthMethod =
  | "signInWithGoogle"
  | "signInWithApple"
  | "signInWithEmail"
  | "createAccountWithEmail"
  | "sendPasswordReset"
  | "reauthenticate";

/** One line per call, in order: what the tests check (the order of the sign-out, the logins). */
export type FakeAuthCall =
  | { readonly method: FakeAuthMethod }
  | { readonly method: "signOut"; readonly reason: SignOutReason }
  | { readonly method: "forgetProviderAccount" }
  | { readonly method: "deleteAccount" }
  | { readonly method: "getIdToken"; readonly forceRefresh: boolean };

export interface FakeAuthSessionOptions {
  readonly initial?: SessionSnapshot;
  /** The account a successful login opens. */
  readonly account?: AccountView;
  readonly supported?: readonly AuthProvider[];
  /** Told of every call as it happens, to check the order against other fakes. */
  readonly onCall?: (call: FakeAuthCall) => void;
}

export interface FakeAuthSession extends AuthSession {
  /** The next call of `method` gives this failure (once). Without it, the call succeeds. */
  fail(method: FakeAuthMethod, failure: AuthFailure): void;
  /**
   * Changes the session as the SDK would (a login elsewhere, a session ended by the server). A signed-in
   * snapshot keeps the account of the session unless `identity` names another (an account switch).
   */
  emit(snapshot: SessionSnapshot, identity?: SessionIdentity): void;
  calls(): readonly FakeAuthCall[];
}

const accountKeys = { byIdentity: new WeakMap<SessionIdentity, string>(), made: 0 };

/** The key of a fake account, the same for the same identity (the real one hashes the UID). */
export function fakeAccountKeyOf(identity: SessionIdentity): string {
  const known = accountKeys.byIdentity.get(identity);
  if (known !== undefined) return known;
  accountKeys.made += 1;
  const key = `fake-account-key-${String(accountKeys.made)}`;
  accountKeys.byIdentity.set(identity, key);
  return key;
}

/** A new account for the fake session, to test an account switch. */
export function fakeSessionIdentity(): SessionIdentity {
  return Object.freeze({ opaque: Symbol("fake-account") });
}

export const FAKE_ACCOUNT: AccountView = {
  provider: "google",
  email: "ana@example.com",
  displayName: "Ana Souza",
};

const SIGNS_IN: ReadonlySet<FakeAuthMethod> = new Set([
  "signInWithGoogle",
  "signInWithApple",
  "signInWithEmail",
  "createAccountWithEmail",
]);

/** The `AuthSession` of the tests and of the catalog: scripted results, no network. */
export function createFakeAuthSession(options: FakeAuthSessionOptions = {}): FakeAuthSession {
  const listeners = createListeners();
  const snapshot: { value: SessionSnapshot } = {
    value: options.initial ?? { status: "signedOut", reason: null },
  };
  const failures: { value: ReadonlyMap<FakeAuthMethod, AuthFailure> } = { value: new Map() };
  const calls: { value: readonly FakeAuthCall[] } = { value: [] };
  const supported = new Set(options.supported ?? ["google", "password"]);
  const account = options.account ?? FAKE_ACCOUNT;
  const identity: { value: SessionIdentity } = { value: fakeSessionIdentity() };

  function record(call: FakeAuthCall): void {
    calls.value = [...calls.value, call];
    options.onCall?.(call);
  }

  function emit(next: SessionSnapshot, nextIdentity?: SessionIdentity): void {
    if (nextIdentity !== undefined) identity.value = nextIdentity;
    snapshot.value = next;
    listeners.notify();
  }

  function run(method: FakeAuthMethod): Promise<AuthResult> {
    record({ method });
    const failure = failures.value.get(method);
    if (failure !== undefined) {
      failures.value = new Map([...failures.value].filter(([key]) => key !== method));
      return Promise.resolve(err(failure));
    }
    if (SIGNS_IN.has(method)) emit({ status: "signedIn", account });
    return Promise.resolve(ok(null));
  }

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => snapshot.value,
    supports: (provider) => supported.has(provider),
    signInWithGoogle: () => run("signInWithGoogle"),
    signInWithApple: () => run("signInWithApple"),
    signInWithEmail: () => run("signInWithEmail"),
    createAccountWithEmail: () => run("createAccountWithEmail"),
    sendPasswordReset: () => run("sendPasswordReset"),
    currentSession: () => (snapshot.value.status === "signedIn" ? identity.value : null),
    accountKeyOf: (session) => Promise.resolve(fakeAccountKeyOf(session)),
    getIdToken({ forceRefresh }) {
      record({ method: "getIdToken", forceRefresh });
      return Promise.resolve(snapshot.value.status === "signedIn" ? FAKE_SESSION_TOKEN : null);
    },
    signOut(reason) {
      record({ method: "signOut", reason });
      emit({ status: "signedOut", reason });
      return Promise.resolve();
    },
    forgetProviderAccount() {
      record({ method: "forgetProviderAccount" });
      return Promise.resolve();
    },
    // The password is never recorded: only that a new login was asked.
    reauthenticate: () => run("reauthenticate"),
    deleteAccount(session) {
      if (snapshot.value.status !== "signedIn" || session !== identity.value) {
        return Promise.resolve();
      }
      record({ method: "deleteAccount" });
      emit({ status: "signedOut", reason: "deleted" });
      return Promise.resolve();
    },
    fail(method, failure) {
      failures.value = new Map([...failures.value, [method, failure]]);
    },
    emit,
    calls: () => calls.value,
  };
}
