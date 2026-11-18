import type { SyncHaltCode } from "../ports/court-event-log";
import type { SessionOwnership } from "./session-ownership";

/** What the court says about the upload (question 85): the text of each one is in `strings`. */
export type SyncNotice =
  /** Another phone writes the court now: the 09b (and the 09c before it), no gesture is taken (D7). */
  | { readonly kind: "taken-over" }
  /**
   * Whose the court is, when not this account's: another account opened it, none did (D8), or the
   * account was not read yet. None of them opens for marking.
   */
  | { readonly kind: Exclude<SessionOwnership, "own"> }
  /** The points stay on this phone: a line in the middle strip, and the court goes on. */
  | { readonly kind: "stopped"; readonly reason: SyncHaltCode };

export interface SyncNoticeInput {
  readonly takenOver: boolean;
  readonly syncHalt: SyncHaltCode | null;
  readonly ownership: SessionOwnership;
}

/**
 * By priority: taken over, then whose the court is, then the halt the file keeps; `null` while it
 * sends.
 */
export function selectSyncNotice({
  takenOver,
  syncHalt,
  ownership,
}: SyncNoticeInput): SyncNotice | null {
  if (takenOver) return { kind: "taken-over" };
  if (ownership !== "own") return { kind: ownership };
  return syncHalt === null ? null : { kind: "stopped", reason: syncHalt };
}
