import type { StoredCourtLog } from "../ports/court-event-log";

/**
 * Whose a court session is, for the account signed in now (ADR 0067, D8). Only the account that opened
 * a round session marks and sends it: on any other answer the court takes no command.
 */
export type SessionOwnership =
  /** The account signed in opened it, or it is a sample session (never sent). */
  | "own"
  /** Another account opened it: its points leave only with that account. */
  | "other-account"
  /** A round session opened without an account: nothing ever sends it. */
  | "unowned"
  /**
   * The account signed in was not read yet (the SDK answers after the first frame): the court shows
   * nothing until it is, so the notice of another account never blinks (tester of part 1, finding 2).
   */
  | "account-pending";

export type SessionOwner = Pick<StoredCourtLog, "fromRound" | "ownerKey">;

export function sessionOwnership(owner: SessionOwner, accountKey: string | null): SessionOwnership {
  if (!owner.fromRound) return "own";
  if (owner.ownerKey === null) return "unowned";
  if (accountKey === null) return "account-pending";
  return owner.ownerKey === accountKey ? "own" : "other-account";
}
