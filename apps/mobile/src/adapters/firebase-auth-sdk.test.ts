import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SessionIdentity } from "../services/auth/auth-session";
import { createFirebaseAuthSdk } from "./firebase-auth-sdk";
import type { FirebaseUserView } from "./firebase-auth-session";

interface FakeUser {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly providerData: readonly { readonly providerId: string }[];
}

const firebase = vi.hoisted(() => ({
  auth: { currentUser: null as FakeUser | null },
  listener: null as ((user: FakeUser | null) => void) | null,
  deleted: [] as FakeUser[],
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: (_algorithm: string, data: string) => Promise.resolve(`hash(${data})`),
}));

vi.mock("@react-native-firebase/auth", () => ({
  getAuth: () => firebase.auth,
  onAuthStateChanged: (_auth: unknown, listener: (user: FakeUser | null) => void) => {
    firebase.listener = listener;
    return () => undefined;
  },
  deleteUser: (user: FakeUser) => {
    firebase.deleted.push(user);
    return Promise.resolve();
  },
  getIdToken: () => Promise.resolve("token"),
  createUserWithEmailAndPassword: () => Promise.resolve(),
  signInWithCredential: () => Promise.resolve(),
  signInWithEmailAndPassword: () => Promise.resolve(),
  sendPasswordResetEmail: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  reauthenticateWithCredential: () => Promise.resolve(),
  EmailAuthProvider: { credential: () => ({}) },
  GoogleAuthProvider: { credential: () => ({}) },
}));

const userOf = (uid: string): FakeUser => ({
  uid,
  email: null,
  displayName: null,
  providerData: [{ providerId: "google.com" }],
});

/** The identity the session would hold for `user`, read through the SDK's listener. */
function identitySeen(user: FakeUser): SessionIdentity {
  const seen: { view: FirebaseUserView | null } = { view: null };
  const sdk = createFirebaseAuthSdk();
  sdk.onAuthStateChanged((view) => {
    seen.view = view;
  });
  firebase.listener?.(user);
  if (seen.view === null) throw new Error("the listener did not run");
  return seen.view.identity;
}

describe("createFirebaseAuthSdk.deleteCurrentUser", () => {
  beforeEach(() => {
    firebase.auth.currentUser = null;
    firebase.listener = null;
    firebase.deleted = [];
  });

  function signedIn(uid: string) {
    const sdk = createFirebaseAuthSdk();
    const seen: { identity: SessionIdentity | null } = { identity: null };
    sdk.onAuthStateChanged((view) => {
      seen.identity = view?.identity ?? null;
    });
    const user = userOf(uid);
    firebase.auth.currentUser = user;
    firebase.listener?.(user);
    if (seen.identity === null) throw new Error("the listener did not run");
    return { sdk, identity: seen.identity, user };
  }

  test("deletes the SDK's current user when it is still the given account", async () => {
    const { sdk, identity, user } = signedIn("uid-a");
    expect(await sdk.deleteCurrentUser(identity)).toBe("deleted");
    expect(firebase.deleted).toEqual([user]);
  });

  test("the SDK moved to another account before its listener ran: nothing is deleted", async () => {
    const { sdk, identity } = signedIn("uid-a");
    firebase.auth.currentUser = userOf("uid-b");
    expect(await sdk.deleteCurrentUser(identity)).toBe("other-account");
    expect(firebase.deleted).toEqual([]);
  });

  test("an identity from another wrapper never matches", async () => {
    const { sdk } = signedIn("uid-a");
    const foreign = identitySeen(userOf("uid-a"));
    expect(await sdk.deleteCurrentUser(foreign)).toBe("other-account");
    expect(firebase.deleted).toEqual([]);
  });
});
