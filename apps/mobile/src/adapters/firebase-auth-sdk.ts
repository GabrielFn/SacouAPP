import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "@react-native-firebase/auth";

import type { SessionIdentity } from "../services/auth/auth-session";
import type { FirebaseAuthSdk, FirebaseUserView } from "./firebase-auth-session";

/** One opaque identity per account seen on this phone, so the UID itself never leaves this file. */
function createIdentities(): (uid: string) => SessionIdentity {
  const byUid: { value: ReadonlyMap<string, SessionIdentity> } = { value: new Map() };
  return (uid) => {
    const known = byUid.value.get(uid);
    if (known !== undefined) return known;
    const identity: SessionIdentity = Object.freeze({ opaque: Symbol("session") });
    byUid.value = new Map([...byUid.value, [uid, identity]]);
    return identity;
  };
}

/** The only file that reads the Firebase user; the UID stays here (ADR 0057, D2). */
function viewOf(user: User, identityOf: (uid: string) => SessionIdentity): FirebaseUserView {
  return {
    providerIds: user.providerData.map((info) => info.providerId),
    email: user.email,
    displayName: user.displayName,
    identity: identityOf(user.uid),
    getIdToken: (forceRefresh) => getIdToken(user, forceRefresh),
  };
}

/** A refusal with a code, like the SDK's, for the adapter to read: nobody is signed in. */
const NO_USER = Object.assign(new Error("no current user"), { code: "auth/no-current-user" });

/** `@react-native-firebase/auth`, which keeps the session in the private area of the app (D5). */
export function createFirebaseAuthSdk(): FirebaseAuthSdk {
  const auth = getAuth();
  const identityOf = createIdentities();
  function current(): User {
    const user = auth.currentUser;
    if (user === null) throw NO_USER;
    return user;
  }
  return {
    onAuthStateChanged: (listener) =>
      onAuthStateChanged(auth, (user) => {
        listener(user === null ? null : viewOf(user, identityOf));
      }),
    async signInWithGoogleIdToken(idToken) {
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    },
    async signInWithEmail(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async createAccountWithEmail(email, password) {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    sendPasswordReset: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
    async reauthenticateWithGoogleIdToken(idToken) {
      await reauthenticateWithCredential(current(), GoogleAuthProvider.credential(idToken));
    },
    async reauthenticateWithPassword(password) {
      const user = current();
      if (user.email === null) throw NO_USER;
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    },
    deleteCurrentUser: async () => {
      await deleteUser(current());
    },
  };
}
