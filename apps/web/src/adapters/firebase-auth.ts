import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  useDeviceLanguage,
  type Auth,
  type User,
} from "firebase/auth";

import type { FirebaseWebConfig } from "../config/page-config";
import type { AuthOutcome, AuthPort, SessionUser } from "../round-page/ports";

import { outcomeOf, resetOutcomeOf } from "./firebase-failures";

const done: AuthOutcome = { kind: "done" };

function sessionOf(user: User | null): SessionUser | null {
  return user === null ? null : { displayName: user.displayName };
}

async function attempt(run: () => Promise<unknown>): Promise<AuthOutcome> {
  try {
    await run();
    return done;
  } catch (error) {
    return outcomeOf(error);
  }
}

/**
 * Firebase Auth Web, only `firebase/app` and `firebase/auth`, bundled and served from the page's own host. The session
 * stays in the browser (IndexedDB, then local storage): "login uma vez" (`decisoes.md:7`, ADR 0070, D4).
 */
export function createFirebaseAuth(config: FirebaseWebConfig): AuthPort {
  const app = initializeApp(config);
  const auth: Auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  useDeviceLanguage(auth);
  const google = new GoogleAuthProvider();

  return {
    restore: async () => {
      try {
        await getRedirectResult(auth);
      } catch {
        // A failed redirect leaves the person signed out; the sheet opens again on the next tap.
      }
      await auth.authStateReady();
      return sessionOf(auth.currentUser);
    },
    signInWithGooglePopup: () => attempt(() => signInWithPopup(auth, google)),
    signInWithGoogleRedirect: () => attempt(() => signInWithRedirect(auth, google)),
    signInWithEmail: (email, password) => attempt(() => signInWithEmailAndPassword(auth, email, password)),
    signUpWithEmail: (email, password) => attempt(() => createUserWithEmailAndPassword(auth, email, password)),
    sendPasswordReset: async (email) => {
      try {
        await sendPasswordResetEmail(auth, email);
        return done;
      } catch (error) {
        return resetOutcomeOf(error);
      }
    },
    currentUser: () => sessionOf(auth.currentUser),
    idToken: async () => (auth.currentUser === null ? null : auth.currentUser.getIdToken()),
    signOut: () => signOut(auth),
  };
}
