import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "@react-native-firebase/auth";

import type { FirebaseAuthSdk, FirebaseUserView } from "./firebase-auth-session";

/** The only file that reads the Firebase user; the UID stays here (ADR 0057, D2). */
function viewOf(user: User): FirebaseUserView {
  return {
    providerIds: user.providerData.map((info) => info.providerId),
    email: user.email,
    displayName: user.displayName,
    getIdToken: (forceRefresh) => getIdToken(user, forceRefresh),
  };
}

/** `@react-native-firebase/auth`, which keeps the session in the private area of the app (D5). */
export function createFirebaseAuthSdk(): FirebaseAuthSdk {
  const auth = getAuth();
  return {
    onAuthStateChanged: (listener) =>
      onAuthStateChanged(auth, (user) => {
        listener(user === null ? null : viewOf(user));
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
  };
}
