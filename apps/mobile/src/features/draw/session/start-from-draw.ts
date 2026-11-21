import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtSessionOrigin } from "../../court/ports/court-event-log";
import type { CourtRuntime } from "../../court/ports/court-runtime";
import {
  ensureRoundCourtSession,
  type EnsureRoundCourtError,
} from "../../court/session/ensure-round-court-session";
import { closeStaleCourt } from "../../court/session/close-stale-court";
import type { RoundCourt } from "../../court/session/round-court";
import { startCourtMatch } from "../../court/session/start-court-match";
import { opensTakeover, type CourtSummaryLookup } from "../../court/takeover/court-summary-lookup";
import { buildMatchStart, type MatchStartInput } from "../model/match-start";

/** Why the match did not start; only codes, never a value of the draw. */
export type StartFromDrawError =
  | "other-round-match-open"
  | "other-account"
  | "no-account"
  | "match-open"
  /** The forgotten match of another round was not ended (R97, D5): nothing started. */
  | "close-other-failed"
  | "failed";

/** The session errors the pre-game says as they are; a load that failed is the generic line. */
function sessionError(error: EnsureRoundCourtError): StartFromDrawError {
  return error.code === "load-failed" ? "failed" : error.code;
}

/**
 * "Começar partida" (D7): the session of the round on this device, then the `MatchStarted` of the draw
 * through the one public door of the court. The session comes back, for `router.replace` to the court.
 * `closeFirst` is the forgotten match of a round that ended, confirmed on the sheet (R97, D5): it is
 * ended and closed first, and nothing starts when that fails.
 */
export async function startFromDraw(
  runtime: CourtRuntime,
  origin: CourtSessionOrigin,
  input: MatchStartInput,
  closeFirst: string | null = null,
): Promise<Result<string, StartFromDrawError>> {
  const payload = buildMatchStart(input, runtime.ids.newId());
  if (!payload.ok) return err("failed");
  if (closeFirst !== null) {
    const closed = await closeStaleCourt(runtime, closeFirst);
    if (!closed.ok) return err("close-other-failed");
  }
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

/** Where "Começar partida" leads: the court that started, or the 09a of the court of the round. */
export type CourtOpening =
  { readonly kind: "court"; readonly courtSessionId: string } | { readonly kind: "take-over" };

export interface StartOrTakeOverDeps {
  /** The summary read now, or `undefined` offline: offline the match starts as before. */
  readonly lookUp: () => Promise<CourtSummaryLookup | undefined>;
  readonly local: RoundCourt | null;
  readonly start: () => Promise<Result<string, StartFromDrawError>>;
}

/**
 * "Começar partida" with a network (E4.11, D5, case a): when the server has a stream of the round this
 * phone does not write, the 09a comes first and nothing is started here.
 */
export async function startOrTakeOver(
  deps: StartOrTakeOverDeps,
): Promise<Result<CourtOpening, StartFromDrawError>> {
  if (opensTakeover(await deps.lookUp(), deps.local)) return ok({ kind: "take-over" });
  const started = await deps.start();
  return started.ok ? ok({ kind: "court", courtSessionId: started.value }) : started;
}
