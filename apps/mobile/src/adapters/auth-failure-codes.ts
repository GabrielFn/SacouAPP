import type { AuthFailure } from "../services/auth/auth-session";

/**
 * Firebase codes to the closed union of the port. With the e-mail enumeration protection on, Firebase
 * joins the wrong password and the unknown user; the app joins them too, so the screen is no oracle
 * (ADR 0057, D7). Only the code is read: the message of the SDK may carry the e-mail.
 */
const FIREBASE_FAILURES: Readonly<Record<string, AuthFailure>> = {
  "auth/wrong-password": "invalid-credentials",
  "auth/user-not-found": "invalid-credentials",
  "auth/invalid-credential": "invalid-credentials",
  "auth/invalid-login-credentials": "invalid-credentials",
  "auth/invalid-email": "invalid-credentials",
  "auth/user-disabled": "invalid-credentials",
  "auth/email-already-in-use": "email-unavailable",
  "auth/account-exists-with-different-credential": "email-unavailable",
  "auth/weak-password": "weak-password",
  "auth/too-many-requests": "too-many-requests",
  "auth/network-request-failed": "offline",
  "auth/operation-not-allowed": "provider-unavailable",
};

function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const { code } = error;
  return typeof code === "string" || typeof code === "number" ? String(code) : null;
}

export function firebaseFailureOf(error: unknown): AuthFailure {
  const code = codeOf(error);
  return (code === null ? undefined : FIREBASE_FAILURES[code]) ?? "unexpected";
}

/** The status codes of the Google picker; the values come from the native module at run time. */
export interface GoogleStatusCodes {
  readonly SIGN_IN_CANCELLED: string;
  readonly IN_PROGRESS: string;
  readonly PLAY_SERVICES_NOT_AVAILABLE: string;
}

/** A second picker while one is open is treated as a cancel: the first one goes on. */
export function googleFailureOf(error: unknown, codes: GoogleStatusCodes): AuthFailure {
  const code = codeOf(error);
  if (code === codes.SIGN_IN_CANCELLED || code === codes.IN_PROGRESS) return "cancelled";
  if (code === codes.PLAY_SERVICES_NOT_AVAILABLE) return "provider-unavailable";
  return "unexpected";
}
