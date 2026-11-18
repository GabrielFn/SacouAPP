import type { SyncHaltCode } from "../ports/court-event-log";

/** What the court says about the upload (question 85): the text of each one is in `strings`. */
export type SyncNotice =
  /** Another phone writes the court now: the 09b, and no gesture is taken (D7). */
  | { readonly kind: "taken-over" }
  /** The points stay on this phone: a line in the middle strip, and the court goes on. */
  | { readonly kind: "stopped"; readonly reason: SyncHaltCode | "other-account" };

export interface SyncNoticeInput {
  readonly takenOver: boolean;
  readonly syncHalt: SyncHaltCode | null;
  /** The session belongs to another account (or to none) than the one signed in. */
  readonly otherAccount: boolean;
}

/** By priority: taken over, then the halt the file keeps, then the account; `null` while it sends. */
export function selectSyncNotice({
  takenOver,
  syncHalt,
  otherAccount,
}: SyncNoticeInput): SyncNotice | null {
  if (takenOver) return { kind: "taken-over" };
  if (syncHalt !== null) return { kind: "stopped", reason: syncHalt };
  return otherAccount ? { kind: "stopped", reason: "other-account" } : null;
}
