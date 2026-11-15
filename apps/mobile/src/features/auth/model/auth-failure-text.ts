import type { AuthFailure, SessionSnapshot } from "../../../services/auth/auth-session";
import { strings } from "../../../strings/pt-BR";

const { auth } = strings;

/** The text of a refused login; a cancel says nothing. */
export function authFailureText(failure: AuthFailure | null): string | null {
  return failure === null || failure === "cancelled" ? null : auth.failures[failure];
}

/** Why the login screen shows: read from the snapshot, never from a route parameter (D4). */
export function signOutReasonText(snapshot: SessionSnapshot): string | null {
  if (snapshot.status !== "signedOut") return null;
  switch (snapshot.reason) {
    case "expired":
      return auth.reasons.expired;
    case "deleted":
      return auth.reasons.deleted;
    case "signedOut":
    case null:
      return null;
  }
}
