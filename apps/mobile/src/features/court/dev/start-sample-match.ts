import type { MatchStartedPayload } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtRuntime } from "../ports/court-runtime";
import { startCourtMatch, type StartCourtMatchError } from "../session/start-court-match";
import {
  SAMPLE_MATCH_BEST_OF_THREE,
  SAMPLE_MATCH_ONE_SET,
  SAMPLE_MATCH_WITH_LIBERO,
} from "./sample-match.data";

export type SampleMatchKind = "one-set" | "best-of-three" | "with-libero";

const SAMPLE_MATCHES: Readonly<Record<SampleMatchKind, MatchStartedPayload>> = {
  "one-set": SAMPLE_MATCH_ONE_SET,
  "best-of-three": SAMPLE_MATCH_BEST_OF_THREE,
  "with-libero": SAMPLE_MATCH_WITH_LIBERO,
};

export interface StartedSampleMatch {
  readonly courtSessionId: string;
}

/**
 * Starts a sample match in a new court session, closing the one that was open (a device plays one
 * court at a time). The same door the pre-game will use: `startCourtMatch`.
 */
export async function startSampleMatch(
  { log, replayer, ids }: CourtRuntime,
  kind: SampleMatchKind,
): Promise<Result<StartedSampleMatch, StartCourtMatchError>> {
  const previous = await log.findActiveSession();
  if (previous.ok && previous.value !== null) {
    await log.closeSession(previous.value);
  }
  const courtSessionId = ids.newId();
  const started = await startCourtMatch(
    { courtSessionId, log, replayer, ids },
    SAMPLE_MATCHES[kind],
  );
  return started.ok ? ok({ courtSessionId }) : err(started.error);
}
