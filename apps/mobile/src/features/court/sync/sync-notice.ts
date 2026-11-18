import type { SyncHaltCode } from "../ports/court-event-log";
import type { SessionOwnership } from "./session-ownership";

/** What the court says about the upload (question 85): the text of each one is in `strings`. */
export type SyncNotice =
  /** Another phone writes the court now: the 09b, and no gesture is taken (D7). */
  | { readonly kind: "taken-over" }
  /** Another account opened this court: it does not open for marking on this one (D8). */
  | { readonly kind: "other-account" }
  /** The points stay on this phone: a line in the middle strip, and the court goes on. */
  | { readonly kind: "stopped"; readonly reason: SyncHaltCode | "unowned" };

export interface SyncNoticeInput {
  readonly takenOver: boolean;
  readonly syncHalt: SyncHaltCode | null;
  readonly ownership: SessionOwnership;
}

/**
 * By priority: taken over, another account, then the halt the file keeps and a session without an
 * owner (the generic line); `null` while it sends.
 */
export function selectSyncNotice({
  takenOver,
  syncHalt,
  ownership,
}: SyncNoticeInput): SyncNotice | null {
  if (takenOver) return { kind: "taken-over" };
  if (ownership === "other-account") return { kind: "other-account" };
  if (syncHalt !== null) return { kind: "stopped", reason: syncHalt };
  return ownership === "unowned" ? { kind: "stopped", reason: "unowned" } : null;
}
