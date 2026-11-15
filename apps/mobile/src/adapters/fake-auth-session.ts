import { err, ok } from "@sacou/volley-rules";

import type {
  AccountView,
  AuthFailure,
  AuthProvider,
  AuthResult,
  AuthSession,
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
  | "sendPasswordReset";

/** One line per call, in order: what the tests check (the order of the sign-out, the logins). */
export type FakeAuthCall =
  | { readonly method: FakeAuthMethod }
  | { readonly method: "signOut"; readonly reason: SignOutReason }
  | { readonly method: "forgetProviderAccount" }
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
  /** Changes the session as the SDK would (a login elsewhere, a session ended by the server). */
  emit(snapshot: SessionSnapshot): void;
  calls(): readonly FakeAuthCall[];
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
  const state = {
    snapshot: options.initial ?? ({ status: "signedOut", reason: null } as SessionSnapshot),
    failures: new Map<FakeAuthMethod, AuthFailure>() as ReadonlyMap<FakeAuthMethod, AuthFailure>,
    calls: [] as readonly FakeAuthCall[],
  };
  const supported = new Set(options.supported ?? ["google", "password"]);
  const account = options.account ?? FAKE_ACCOUNT;

  function record(call: FakeAuthCall): void {
    state.calls = [...state.calls, call];
    options.onCall?.(call);
  }

  function emit(snapshot: SessionSnapshot): void {
    state.snapshot = snapshot;
    listeners.notify();
  }

  function run(method: FakeAuthMethod): Promise<AuthResult> {
    record({ method });
    const failure = state.failures.get(method);
    if (failure !== undefined) {
      state.failures = new Map([...state.failures].filter(([key]) => key !== method));
      return Promise.resolve(err(failure));
    }
    if (SIGNS_IN.has(method)) emit({ status: "signedIn", account });
    return Promise.resolve(ok(null));
  }

  return {
    subscribe: (listener) => listeners.add(listener),
    snapshot: () => state.snapshot,
    supports: (provider) => supported.has(provider),
    signInWithGoogle: () => run("signInWithGoogle"),
    signInWithApple: () => run("signInWithApple"),
    signInWithEmail: () => run("signInWithEmail"),
    createAccountWithEmail: () => run("createAccountWithEmail"),
    sendPasswordReset: () => run("sendPasswordReset"),
    getIdToken({ forceRefresh }) {
      record({ method: "getIdToken", forceRefresh });
      return Promise.resolve(state.snapshot.status === "signedIn" ? FAKE_SESSION_TOKEN : null);
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
    fail(method, failure) {
      state.failures = new Map([...state.failures, [method, failure]]);
    },
    emit,
    calls: () => state.calls,
  };
}
