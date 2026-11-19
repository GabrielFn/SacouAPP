import type { Failure, Intent, Standing } from "./round-page.types";

/** What a Firebase call ended in. `popupBlocked` sends the controller to the redirect; `cancelled` explains nothing. */
export type AuthOutcome =
  | { readonly kind: "done" }
  | { readonly kind: "popupBlocked" }
  | { readonly kind: "cancelled" }
  | { readonly kind: "failed"; readonly failure: Failure };

/** The person Firebase holds in this browser: only what the page shows back (the nickname suggestion). */
export interface SessionUser {
  readonly displayName: string | null;
}

/**
 * The login of the page (Firebase Auth Web, ADR 0070, D4). The session lives in the browser's storage of the SDK;
 * the API never makes a cookie or a token of its own.
 */
export interface AuthPort {
  /** Waits for Firebase's first answer, a returning Google redirect included. */
  restore(): Promise<SessionUser | null>;
  signInWithGooglePopup(): Promise<AuthOutcome>;
  /** Leaves the page; the intent must be kept before. */
  signInWithGoogleRedirect(): Promise<AuthOutcome>;
  signInWithEmail(email: string, password: string): Promise<AuthOutcome>;
  signUpWithEmail(email: string, password: string): Promise<AuthOutcome>;
  /** Always `done` for an unknown e-mail too: the page is no oracle (ADR 0057, D7). */
  sendPasswordReset(email: string): Promise<AuthOutcome>;
  currentUser(): SessionUser | null;
  /** The Firebase ID token for `Authorization: Bearer`, or null when signed out. */
  idToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

export type ApiOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: Failure };

/** The Sacou API, same origin, always with the caller's ID token. */
export interface ApiPort {
  /** `POST /v1/me`, then whether the person already saved a profile (`GET /v1/me/profile`). */
  register(): Promise<ApiOutcome<{ readonly hasProfile: boolean }>>;
  /** `PUT /v1/me/profile` with the nickname only (question 129). */
  saveNickname(nickname: string): Promise<ApiOutcome<null>>;
  /** `POST /v1/round-links/attendance`: joins as an avulso when needed, then answers (ADR 0070, D2). */
  answer(code: string, intent: Intent): Promise<ApiOutcome<Standing>>;
  /** Where a member stands already (`resolve`, then the round); null for whoever is not in the group yet. */
  standing(code: string): Promise<ApiOutcome<Standing | null>>;
}

/** Keeps the intent across the Google redirect only (session storage), and gives it back once. */
export interface PendingIntentStore {
  keep(intent: Intent): void;
  take(): Intent | null;
}
