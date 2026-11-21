import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtRuntime } from "../ports/court-runtime";
import { sessionOwnership } from "../sync/session-ownership";
import { createCourtSessionController } from "./court-session-controller";
import { sessionState } from "./round-court";

/** Why the forgotten match was left as it was: only codes. */
export type CloseStaleCourtError =
  /** Another account (or none) opened it: its points leave only with that account (D8). */
  | "other-account"
  /** The end of the match was not written, or the session did not close: nothing else changed. */
  | "failed";

/** Whether the session still has a match not ended; one that cannot be replayed counts as open. */
async function hasOpenMatch(runtime: CourtRuntime, courtSessionId: string): Promise<boolean> {
  const state = await sessionState(runtime, courtSessionId);
  return !state.ok || state.value.currentMatch !== null;
}

/**
 * "Encerrar a antiga e começar esta" (R97, D5, ADR 0074): the match forgotten in a round that already
 * ended gets its end by hand (`MatchEnded`, manual) and its session closes, so a new round may open
 * its own. Closing never erases an event: the points not sent yet keep leaving (`findSessionsToSync`
 * reads the closed sessions too), and an upload starts at once. A session another phone took over is
 * written by that phone: here it only closes, with nothing appended (ADR 0063). Idempotent: a session
 * already closed, or with no match open any more (a first try that closed it and then failed to start
 * the new match), closes again with nothing appended.
 */
export async function closeStaleCourt(
  runtime: CourtRuntime,
  courtSessionId: string,
): Promise<Result<void, CloseStaleCourtError>> {
  const { log, sync } = runtime;
  const stored = await log.load(courtSessionId);
  if (!stored.ok) return err("failed");
  if (sessionOwnership(stored.value, await sync.ownerKey()) !== "own") return err("other-account");
  if (stored.value.takenOverBatch === null && (await hasOpenMatch(runtime, courtSessionId))) {
    const controller = createCourtSessionController({ ...runtime, courtSessionId });
    const ended = await controller.dispatch({ type: "end-match-manually" });
    if (!ended.ok) return err("failed");
  }
  const closed = await log.closeSession(courtSessionId);
  if (!closed.ok) return err("failed");
  sync.notifyAppended();
  return ok(undefined);
}
