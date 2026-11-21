import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtRuntime } from "../ports/court-runtime";
import { sessionOwnership, type SessionOwnership } from "../sync/session-ownership";
import type { LoadFailureCode } from "./court-errors";
import { sessionState } from "./round-court";

/**
 * The open session of this device that holds a match of another round (R97, D2 and D5): the device
 * plays one court at a time, so it keeps "Começar partida" of this round from opening a second one.
 */
export interface OtherRoundCourt {
  readonly courtSessionId: string;
  /** Only IDs; `null` for a sample session of the development screen. */
  readonly origin: CourtSessionOrigin | null;
  /** When the session opened (wall clock, ms), or `null` when the log does not know (R97, D4). */
  readonly openedAt: number | null;
  /** Whose it is for the account signed in now (D8): only the owner may end it. */
  readonly ownership: SessionOwnership;
}

/**
 * The court that holds a match of another round, or `null`: none open, the one of this round, or one
 * without a match on (that one is closed in silence when this round opens its own).
 */
export async function readOtherRoundCourt(
  runtime: Pick<CourtRuntime, "log" | "replayer" | "sync">,
  roundId: string,
): Promise<Result<OtherRoundCourt | null, LoadFailureCode>> {
  const { log } = runtime;
  const active = await log.findActiveSession();
  if (!active.ok) return err(active.error.code);
  if (active.value === null) return ok(null);
  const courtSessionId = active.value;
  const origin = await log.findOrigin(courtSessionId);
  if (!origin.ok) return err(origin.error.code);
  if (origin.value?.roundId === roundId) return ok(null);
  const state = await sessionState(runtime, courtSessionId);
  if (!state.ok) return state;
  if (state.value.currentMatch === null) return ok(null);
  const stored = await log.load(courtSessionId);
  if (!stored.ok) return err(stored.error.code);
  const openedAt = await log.findOpenedAt(courtSessionId);
  if (!openedAt.ok) return err(openedAt.error.code);
  const ownership = sessionOwnership(stored.value, await runtime.sync.ownerKey());
  return ok({ courtSessionId, origin: origin.value, openedAt: openedAt.value, ownership });
}
