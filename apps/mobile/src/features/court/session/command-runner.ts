import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtEventLog } from "../ports/court-event-log";
import type { IdGenerator } from "../../../services/id/id-generator";
import { highestSequence } from "../persistence/append-rules";
import { draftsFor, type CourtCommand } from "./command-drafts";
import type { CommandError } from "./court-errors";
import type { CourtReplayer } from "./court-replay";
import type { WriteContext } from "./court-session-loader";
import { buildEnvelopes } from "./envelope-factory";

export interface CommandRunnerDeps {
  readonly courtSessionId: string;
  readonly log: CourtEventLog;
  readonly replayer: CourtReplayer;
  readonly ids: IdGenerator;
}

/**
 * Runs one command against the persisted log and returns the whole log after it. The order is the
 * guarantee: the engine decides, the new log is replayed (simulated) and only a log that replays
 * is written, so a late point or an invalid revert never reaches the file (ADR 0023). Nothing is
 * changed in memory here: the caller publishes the result after the commit.
 */
export async function runCourtCommand(
  { courtSessionId, log, replayer, ids }: CommandRunnerDeps,
  context: WriteContext,
  events: readonly EventEnvelope[],
  command: CourtCommand,
): Promise<Result<readonly EventEnvelope[], CommandError>> {
  const current = replayer.replay(courtSessionId, events);
  if (!current.ok) {
    return err({ code: "rejected" });
  }
  const drafts = draftsFor(command, current.value);
  if (!drafts.ok) {
    return drafts;
  }
  const envelopes = buildEnvelopes(drafts.value, {
    ...context,
    courtSessionId,
    firstSequence: highestSequence(events, context.deviceId) + 1,
    ids,
  });
  if (!envelopes.ok) {
    return err({ code: "rejected" });
  }
  const candidate = [...events, ...envelopes.value];
  if (!replayer.replay(courtSessionId, candidate).ok) {
    return err({ code: "rejected" });
  }
  const written = await log.append(courtSessionId, envelopes.value);
  return written.ok ? ok(candidate) : err({ code: "write-failed", cause: written.error.code });
}
