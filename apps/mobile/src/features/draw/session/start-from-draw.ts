import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtSessionOrigin } from "../../court/ports/court-event-log";
import type { CourtRuntime } from "../../court/ports/court-runtime";
import {
  ensureRoundCourtSession,
  type EnsureRoundCourtError,
} from "../../court/session/ensure-round-court-session";
import { startCourtMatch } from "../../court/session/start-court-match";
import { buildMatchStart, type MatchStartInput } from "../model/match-start";

/** Why the match did not start; only codes, never a value of the draw. */
export type StartFromDrawError =
  "other-round-match-open" | "other-account" | "no-account" | "match-open" | "failed";

/** The session errors the pre-game says as they are; a load that failed is the generic line. */
function sessionError(error: EnsureRoundCourtError): StartFromDrawError {
  return error.code === "load-failed" ? "failed" : error.code;
}

/**
 * "Começar partida" (D7): the session of the round on this device, then the `MatchStarted` of the draw
 * through the one public door of the court. The session comes back, for `router.replace` to the court.
 */
export async function startFromDraw(
  runtime: CourtRuntime,
  origin: CourtSessionOrigin,
  input: MatchStartInput,
): Promise<Result<string, StartFromDrawError>> {
  const payload = buildMatchStart(input, runtime.ids.newId());
  if (!payload.ok) return err("failed");
  const session = await ensureRoundCourtSession(runtime, origin);
  if (!session.ok) {
    return err(sessionError(session.error));
  }
  const started = await startCourtMatch(
    { ...runtime, courtSessionId: session.value },
    payload.value,
  );
  if (started.ok) return ok(session.value);
  const refusedAsOpen =
    started.error.code === "refused" && started.error.reason === "match-already-open";
  return err(refusedAsOpen ? "match-open" : "failed");
}
