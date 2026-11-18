import type { StoredCourtLog } from "../ports/court-event-log";

/**
 * Whose a court session is, for the account signed in now (ADR 0067, D8). Only the account that opened
 * a round session marks and sends it: on another account the court does not open for marking.
 */
export type SessionOwnership =
  /** The account signed in opened it, or it is a sample session (never sent). */
  | "own"
  /** Another account opened it: its points leave only with that account. */
  | "other-account"
  /** A round session opened without an account: nothing ever sends it. */
  | "unowned";

export type SessionOwner = Pick<StoredCourtLog, "fromRound" | "ownerKey">;

export function sessionOwnership(owner: SessionOwner, accountKey: string | null): SessionOwnership {
  if (!owner.fromRound) return "own";
  if (owner.ownerKey === null) return "unowned";
  return owner.ownerKey === accountKey ? "own" : "other-account";
}
