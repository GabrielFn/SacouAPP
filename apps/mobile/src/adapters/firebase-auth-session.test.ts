import { err, ok, type Result } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import type { AuthFailure } from "../services/auth/auth-session";
import { firebaseFailureOf, googleFailureOf, type GoogleStatusCodes } from "./auth-failure-codes";
import {
  createFirebaseAuthSession,
  TokenRenewalOffline,
  type FirebaseAuthSdk,
  type FirebaseUserView,
  type GoogleAccountPicker,
} from "./firebase-auth-session";

const PLANTED_EMAIL = "planted.person@example.com";
const TOKEN = "firebase-id-token-Lm8";
const GOOGLE_TOKEN = "google-id-token-Rt2";

function sdkError(code: string): Error {
  return Object.assign(new Error(`[${code}] no user ${PLANTED_EMAIL}`), { code });
}

interface FakeSdk extends FirebaseAuthSdk {
  change(user: FirebaseUserView | null): void;
  failNext(code: string): void;
  readonly log: string[];
}

function userView(
  providerIds: readonly string[],
  forced: boolean[] = [],
  tokenFailure: string | null = null,
): FirebaseUserView {
  return {
    providerIds,
    email: "ana@example.com",
    displayName: "Ana Souza",
    getIdToken: (forceRefresh) => {
      forced.push(forceRefresh);
      return tokenFailure === null
        ? Promise.resolve(TOKEN)
        : Promise.reject(sdkError(tokenFailure));
    },
  };
}

function fakeSdk(): FakeSdk {
  const listeners: ((user: FirebaseUserView | null) => void)[] = [];
  const failure: { current: string | null } = { current: null };
  const log: string[] = [];
  const run = (name: string) => {
    log.push(name);
    const code = failure.current;
    failure.current = null;
    return code === null ? Promise.resolve() : Promise.reject(sdkError(code));
  };
  return {
    log,
    onAuthStateChanged(listener) {
      listeners.push(listener);
      return () => undefined;
    },
    change(user) {
      listeners.forEach((listener) => {
        listener(user);
      });
    },
    failNext(code) {
      failure.current = code;
    },
    signInWithGoogleIdToken: (idToken) => run(`google:${idToken === GOOGLE_TOKEN ? "ok" : "?"}`),
    signInWithEmail: () => run("email"),
    createAccountWithEmail: () => run("create"),
    sendPasswordReset: () => run("reset"),
    signOut: () => run("signOut"),
  };
}

function picker(result: Result<string, AuthFailure> = ok(GOOGLE_TOKEN)): GoogleAccountPicker & {
  readonly forgotten: () => number;
} {
  const count = { value: 0 };
  return {
    pick: () => Promise.resolve(result),
    forget: () => {
      count.value += 1;
      return Promise.resolve();
    },
    forgotten: () => count.value,
  };
}

describe("the Firebase session", () => {
  test("unknown until the SDK answers, then the account without the UID", () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: picker() });
    expect(session.snapshot()).toEqual({ status: "unknown" });
    sdk.change(userView(["google.com"]));
    const snapshot = session.snapshot();
    expect(snapshot).toEqual({
      status: "signedIn",
      account: { provider: "google", email: "ana@example.com", displayName: "Ana Souza" },
    });
    if (snapshot.status !== "signedIn") throw new Error("signed in expected");
    expect(Object.keys(snapshot.account).sort()).toEqual(["displayName", "email", "provider"]);
    expect(Object.keys(snapshot).sort()).toEqual(["account", "status"]);
  });

  test("the provider comes from the Firebase provider IDs", () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: null });
    sdk.change(userView(["password"]));
    expect(session.snapshot()).toMatchObject({ account: { provider: "password" } });
    sdk.change(userView(["apple.com"]));
    expect(session.snapshot()).toMatchObject({ account: { provider: "apple" } });
  });

  test("subscribers hear every change; the snapshot is stable between changes", () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: null });
    const heard: string[] = [];
    session.subscribe(() => heard.push(session.snapshot().status));
    sdk.change(null);
    expect(session.snapshot()).toBe(session.snapshot());
    sdk.change(userView(["password"]));
    expect(heard).toEqual(["signedOut", "signedIn"]);
  });

  test("the reason of the end: asked, fallen elsewhere, or never open", async () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: null });
    sdk.change(null);
    expect(session.snapshot()).toEqual({ status: "signedOut", reason: null });
    sdk.change(userView(["password"]));
    await session.signOut("signedOut");
    sdk.change(null);
    expect(session.snapshot()).toEqual({ status: "signedOut", reason: "signedOut" });
    sdk.change(userView(["password"]));
    sdk.change(null);
    expect(session.snapshot()).toEqual({ status: "signedOut", reason: "expired" });
  });

  test("getIdToken waits for the SDK, gives null signed out and passes forceRefresh", async () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: null });
    const early = session.getIdToken({ forceRefresh: false });
    sdk.change(null);
    expect(await early).toBeNull();
    const forced: boolean[] = [];
    sdk.change(userView(["password"], forced));
    expect(await session.getIdToken({ forceRefresh: true })).toBe(TOKEN);
    expect(await session.getIdToken({ forceRefresh: false })).toBe(TOKEN);
    expect(forced).toEqual([true, false]);
  });

  test("only no network rejects the token; any other refusal of the SDK ends the session", async () => {
    const offlineSdk = fakeSdk();
    const offline = createFirebaseAuthSession({ sdk: offlineSdk, google: null });
    offlineSdk.change(userView(["password"], [], "auth/network-request-failed"));
    const rejected = offline.getIdToken({ forceRefresh: true });
    await expect(rejected).rejects.toBeInstanceOf(TokenRenewalOffline);
    await expect(rejected).rejects.not.toHaveProperty("message", expect.stringContaining("@"));
    for (const code of ["auth/user-token-expired", "auth/user-disabled", "auth/odd"]) {
      const sdk = fakeSdk();
      const session = createFirebaseAuthSession({ sdk, google: null });
      sdk.change(userView(["password"], [], code));
      expect(await session.getIdToken({ forceRefresh: true })).toBeNull();
    }
  });

  test("Google: the picker token becomes a Firebase credential", async () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: picker() });
    expect(await session.signInWithGoogle()).toEqual(ok(null));
    expect(sdk.log).toEqual(["google:ok"]);
  });

  test("Google: a cancel never reaches Firebase; no client ID means no Google", async () => {
    const sdk = fakeSdk();
    const cancelled = createFirebaseAuthSession({ sdk, google: picker(err("cancelled")) });
    expect(await cancelled.signInWithGoogle()).toEqual(err("cancelled"));
    expect(sdk.log).toEqual([]);
    const without = createFirebaseAuthSession({ sdk, google: null });
    expect(without.supports("google")).toBe(false);
    expect(without.supports("password")).toBe(true);
    expect(await without.signInWithGoogle()).toEqual(err("provider-unavailable"));
  });

  test("Apple is not offered in the pilot (question 58)", async () => {
    const session = createFirebaseAuthSession({ sdk: fakeSdk(), google: picker() });
    expect(session.supports("apple")).toBe(false);
    expect(await session.signInWithApple()).toEqual(err("provider-unavailable"));
  });

  test("a refusal is a kind, never the raw message with the e-mail", async () => {
    const sdk = fakeSdk();
    const session = createFirebaseAuthSession({ sdk, google: null });
    sdk.failNext("auth/user-not-found");
    const result = await session.signInWithEmail(PLANTED_EMAIL, "senha1");
    expect(result).toEqual(err("invalid-credentials"));
    expect(JSON.stringify(result)).not.toContain(PLANTED_EMAIL);
    sdk.failNext("auth/email-already-in-use");
    expect(await session.createAccountWithEmail(PLANTED_EMAIL, "senha1")).toEqual(
      err("email-unavailable"),
    );
    sdk.failNext("auth/user-not-found");
    expect(await session.sendPasswordReset(PLANTED_EMAIL)).toEqual(err("invalid-credentials"));
  });

  test("sign-out and forgetting the Google account", async () => {
    const sdk = fakeSdk();
    const google = picker();
    const session = createFirebaseAuthSession({ sdk, google });
    await session.signOut("signedOut");
    await session.forgetProviderAccount();
    expect(sdk.log).toEqual(["signOut"]);
    expect(google.forgotten()).toBe(1);
    sdk.failNext("auth/no-current-user");
    await expect(session.signOut("signedOut")).resolves.toBeUndefined();
    sdk.change(null);
    expect(session.snapshot()).toEqual({ status: "signedOut", reason: null });
  });
});

describe("translation of the SDK codes", () => {
  test.each([
    ["auth/wrong-password", "invalid-credentials"],
    ["auth/user-not-found", "invalid-credentials"],
    ["auth/invalid-credential", "invalid-credentials"],
    ["auth/email-already-in-use", "email-unavailable"],
    ["auth/weak-password", "weak-password"],
    ["auth/network-request-failed", "offline"],
    ["auth/too-many-requests", "too-many-requests"],
    ["auth/operation-not-allowed", "provider-unavailable"],
    ["auth/something-new", "unexpected"],
  ])("Firebase %s is %s", (code, failure) => {
    expect(firebaseFailureOf(sdkError(code))).toBe(failure);
  });

  test("anything without a code is unexpected", () => {
    expect(firebaseFailureOf(new Error(PLANTED_EMAIL))).toBe("unexpected");
    expect(firebaseFailureOf(null)).toBe("unexpected");
    expect(firebaseFailureOf("auth/wrong-password")).toBe("unexpected");
  });

  const codes: GoogleStatusCodes = {
    SIGN_IN_CANCELLED: "12501",
    IN_PROGRESS: "ASYNC_OP_IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  };

  test.each([
    ["12501", "cancelled"],
    ["ASYNC_OP_IN_PROGRESS", "cancelled"],
    ["PLAY_SERVICES_NOT_AVAILABLE", "provider-unavailable"],
    ["10", "unexpected"],
  ])("Google %s is %s", (code, failure) => {
    expect(googleFailureOf(sdkError(code), codes)).toBe(failure);
  });
});
