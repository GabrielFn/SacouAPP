import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtSessionOrigin } from "../../court/ports/court-event-log";
import type { CourtRuntime } from "../../court/ports/court-runtime";
import { ensureRoundCourtSession } from "../../court/session/ensure-round-court-session";
import { startCourtMatch } from "../../court/session/start-court-match";
import { buildMatchStart, type MatchStartInput } from "../model/match-start";

/** Why the match did not start; only codes, never a value of the draw. */
export type StartFromDrawError = "other-round-match-open" | "match-open" | "failed";

/**
 * "Começar partida" (D7): the session of the round on this device, then the `MatchStarted` of the draw
 * through the one public door of the court. The route of the court comes back for `router.replace`.
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
    return err(session.error.code === "other-round-match-open" ? session.error.code : "failed");
  }
  const started = await startCourtMatch(
    { ...runtime, courtSessionId: session.value },
    payload.value,
  );
  if (started.ok) return ok(started.value.route);
  const refusedAsOpen =
    started.error.code === "refused" && started.error.reason === "match-already-open";
  return err(refusedAsOpen ? "match-open" : "failed");
}
