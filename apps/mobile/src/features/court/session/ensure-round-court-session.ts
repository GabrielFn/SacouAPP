import { err, ok, type Result } from "@sacou/volley-rules";

import { wallClockNow } from "../../../services/api/wall-clock";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtRuntime } from "../ports/court-runtime";
import { sessionOwnership } from "../sync/session-ownership";
import type { LoadFailureCode } from "./court-errors";
import { sessionState } from "./round-court";

export type EnsureRoundCourtError =
  /**
   * The device plays one court at a time, and the open one of another round has a match on: its ID,
   * so the 08 can lead to it (R97, D2).
   */
  | { readonly code: "other-round-match-open"; readonly courtSessionId: string }
  /** The open session of the round was opened by another account (or by none): D8. */
  | { readonly code: "other-account" }
  /** Nobody is signed in: a session without an owner would never be sent (fails closed). */
  | { readonly code: "no-account" }
  | { readonly code: "load-failed"; readonly cause: LoadFailureCode };

type Ensured = Result<string, EnsureRoundCourtError>;

/** The open session of the round, kept only for the account that opened it (ADR 0067, D8). */
async function reuseOwn(
  runtime: CourtRuntime,
  courtSessionId: string,
  accountKey: string,
): Promise<Ensured> {
  const stored = await runtime.log.load(courtSessionId);
  if (!stored.ok) return err({ code: "load-failed", cause: stored.error.code });
  const ownership = sessionOwnership(stored.value, accountKey);
  return ownership === "own" ? ok(courtSessionId) : err({ code: "other-account" });
}

/** Closes the open session of another round, unless it has a match on. */
async function closeOtherRound(
  runtime: CourtRuntime,
): Promise<Result<void, EnsureRoundCourtError>> {
  const { log } = runtime;
  const active = await log.findActiveSession();
  if (!active.ok) return err({ code: "load-failed", cause: active.error.code });
  if (active.value === null) return ok(undefined);
  const state = await sessionState(runtime, active.value);
  // A session that cannot be read may have a match on: it stays open.
  if (!state.ok) return err({ code: "load-failed", cause: state.error });
  if (state.value.currentMatch !== null) {
    return err({ code: "other-round-match-open", courtSessionId: active.value });
  }
  const closed = await log.closeSession(active.value);
  return closed.ok ? ok(undefined) : err({ code: "load-failed", cause: closed.error.code });
}

/**
 * The court session of a round on this device (D7, D8): the open one of the round when the account
 * signed in opened it, or a new one with the origin (only IDs) and the key of that account. An open
 * session of another round is closed first, as the sample does, unless it has a match on: closing
 * never erases events, but a match in play must not be left behind. If the session one day comes from
 * the server (E3.7), only this function changes.
 */
export async function ensureRoundCourtSession(
  runtime: CourtRuntime,
  origin: CourtSessionOrigin,
  openedAt: number = wallClockNow(),
): Promise<Ensured> {
  const { log, ids } = runtime;
  // The account that opens the session is the only one that ever marks and sends it.
  const accountKey = await runtime.sync.ownerKey();
  if (accountKey === null) return err({ code: "no-account" });
  const own = await log.findOpenSessionOfRound(origin.roundId);
  if (!own.ok) return err({ code: "load-failed", cause: own.error.code });
  if (own.value !== null) return reuseOwn(runtime, own.value, accountKey);
  const closed = await closeOtherRound(runtime);
  if (!closed.ok) return closed;
  const courtSessionId = ids.newId();
  const opened = await log.openSession(courtSessionId, {
    ...origin,
    ownerKey: accountKey,
    openedAt,
  });
  return opened.ok ? ok(courtSessionId) : err({ code: "load-failed", cause: opened.error.code });
}
