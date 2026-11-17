import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtRuntime } from "../ports/court-runtime";
import type { LoadFailureCode } from "./court-errors";
import { sessionState } from "./round-court";

export type EnsureRoundCourtError =
  /** The device plays one court at a time, and the open one of another round has a match on. */
  | { readonly code: "other-round-match-open" }
  | { readonly code: "load-failed"; readonly cause: LoadFailureCode };

/**
 * The court session of a round on this device (D7, D8): the open one of the round, or a new one with
 * the origin (only IDs). An open session of another round is closed first, as the sample does, unless
 * it has a match on: closing never erases events, but a match in play must not be left behind. If the
 * session one day comes from the server (E3.7), only this function changes.
 */
export async function ensureRoundCourtSession(
  runtime: CourtRuntime,
  origin: CourtSessionOrigin,
): Promise<Result<string, EnsureRoundCourtError>> {
  const { log, ids } = runtime;
  const own = await log.findOpenSessionOfRound(origin.roundId);
  if (!own.ok) return err({ code: "load-failed", cause: own.error.code });
  if (own.value !== null) return ok(own.value);
  const active = await log.findActiveSession();
  if (!active.ok) return err({ code: "load-failed", cause: active.error.code });
  if (active.value !== null) {
    const state = await sessionState(runtime, active.value);
    if (state.ok && state.value.currentMatch !== null) {
      return err({ code: "other-round-match-open" });
    }
    await log.closeSession(active.value);
  }
  const courtSessionId = ids.newId();
  const opened = await log.openSession(courtSessionId, origin);
  return opened.ok ? ok(courtSessionId) : err({ code: "load-failed", cause: opened.error.code });
}
