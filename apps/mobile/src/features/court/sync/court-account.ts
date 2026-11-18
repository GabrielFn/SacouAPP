import type { AuthSession } from "../../../services/auth/auth-session";
import type { CourtAccount } from "../ports/court-account";

/**
 * The account of the upload over the session port. The session is read again after the hash: an
 * account that changed meanwhile gives `null`, never the key of one with the session of another.
 */
export function courtAccountOf(
  session: Pick<AuthSession, "currentSession" | "accountKeyOf" | "subscribe">,
): CourtAccount {
  return {
    async current() {
      const identity = session.currentSession();
      if (identity === null) return null;
      const key = await session.accountKeyOf(identity);
      if (key === null || session.currentSession() !== identity) return null;
      return { session: identity, key };
    },
    subscribe: (listener) => session.subscribe(listener),
  };
}
