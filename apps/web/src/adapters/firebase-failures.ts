import type { AuthOutcome } from "../round-page/ports";
import type { Failure } from "../round-page/round-page.types";

/**
 * Firebase codes to the page's outcomes. The wrong password and the unknown user are one failure, as in the app, so the
 * page is no oracle (ADR 0057, D7). Only the code is read: the SDK's message may carry the e-mail.
 */
const FAILURES: Readonly<Record<string, Failure>> = {
  "auth/wrong-password": { kind: "invalidCredentials" },
  "auth/user-not-found": { kind: "invalidCredentials" },
  "auth/invalid-credential": { kind: "invalidCredentials" },
  "auth/invalid-login-credentials": { kind: "invalidCredentials" },
  "auth/invalid-email": { kind: "invalidCredentials" },
  "auth/user-disabled": { kind: "invalidCredentials" },
  "auth/email-already-in-use": { kind: "emailUnavailable" },
  "auth/account-exists-with-different-credential": { kind: "emailUnavailable" },
  "auth/weak-password": { kind: "weakPassword" },
  "auth/too-many-requests": { kind: "tooManySignIns" },
  "auth/network-request-failed": { kind: "offline" },
  "auth/operation-not-allowed": { kind: "providerUnavailable" },
  "auth/operation-not-supported-in-this-environment": { kind: "providerUnavailable" },
  "auth/web-storage-unsupported": { kind: "providerUnavailable" },
  "auth/unauthorized-domain": { kind: "providerUnavailable" },
};

const CANCELLED = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);
const POPUP_BLOCKED = "auth/popup-blocked";
const OFFLINE = "auth/network-request-failed";

export function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const { code } = error;
  return typeof code === "string" ? code : null;
}

export function outcomeOf(error: unknown): AuthOutcome {
  const code = codeOf(error);
  if (code === POPUP_BLOCKED) return { kind: "popupBlocked" };
  if (code !== null && CANCELLED.has(code)) return { kind: "cancelled" };
  return {
    kind: "failed",
    failure: (code === null ? undefined : FAILURES[code]) ?? { kind: "unexpected" },
  };
}

/** The reset link: the same `done` for an unknown e-mail and for a real one; only no connection is said. */
export function resetOutcomeOf(error: unknown): AuthOutcome {
  return codeOf(error) === OFFLINE
    ? { kind: "failed", failure: { kind: "offline" } }
    : { kind: "done" };
}
