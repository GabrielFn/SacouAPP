import type { ApiError } from "../../../services/api/api-error";
import type {
  CourtSessionSummary,
  SacouApi,
  TakeOverCourtAnswer,
} from "../../../services/api/sacou-api";
import type { CourtAccountRef } from "../ports/court-account";
import type { CourtEventLog, CourtSessionOrigin } from "../ports/court-event-log";
import { takeoverFailureOf, withRetryAfter } from "./api-calls";
import { MAX_IMPORTED_EVENTS, readServerStream, type ImportDeps } from "./import-stream";
import type { TakeoverAction } from "./takeover.reducer";

export interface TakeoverDeps extends ImportDeps {
  readonly api: Pick<SacouApi, "takeOverCourt" | "listCourtEvents">;
  readonly log: CourtEventLog;
  /** The account signed in now; the court is taken over and kept only for it (ADR 0067, D8). */
  readonly account: () => Promise<CourtAccountRef | null>;
}

/** The stream as screen 09a showed it: what the take-over expects to find (ADR 0063, D2). */
export interface TakeoverTarget {
  readonly origin: CourtSessionOrigin;
  readonly summary: Pick<CourtSessionSummary, "courtSessionId" | "currentBatch" | "eventCount">;
}

type Dispatch = (action: TakeoverAction) => void;

function isStreamChanged(error: ApiError): boolean {
  return error.kind === "problem" && error.code === "matches.stream-changed";
}

function isCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** The answer is read as untrusted too: a batch, and counts the import can hold. */
function isPlausible({ batch, eventsBefore, lastSequence }: TakeOverCourtAnswer): boolean {
  return (
    isCount(batch) &&
    batch >= 1 &&
    isCount(eventsBefore) &&
    eventsBefore <= MAX_IMPORTED_EVENTS &&
    isCount(lastSequence)
  );
}

async function importAndKeep(
  deps: TakeoverDeps,
  target: TakeoverTarget,
  context: { account: CourtAccountRef; deviceId: string; answer: TakeOverCourtAnswer },
  dispatch: Dispatch,
): Promise<void> {
  const { courtSessionId } = target.summary;
  const ref = { ...target.origin, courtSessionId };
  const { account, deviceId, answer } = context;
  dispatch({ type: "taken-over", eventsBefore: answer.eventsBefore });
  const read = await readServerStream(deps, {
    ref,
    eventsBefore: answer.eventsBefore,
    onProgress: (imported) => {
      dispatch({ type: "page-imported", imported });
    },
  });
  if (!read.ok) {
    dispatch({ type: "failed", reason: read.error });
    return;
  }
  // The court is kept for the account that took it over: another one signed in meanwhile gets nothing.
  if ((await deps.account())?.session !== account.session) {
    dispatch({ type: "failed", reason: "no-account" });
    return;
  }
  const kept = await deps.log.replaceWithServerStream({
    courtSessionId,
    origin: { ...target.origin, ownerKey: account.key },
    deviceId,
    events: read.value,
    batch: answer.batch,
    lastSequence: answer.lastSequence,
  });
  if (!kept.ok) {
    const invalid = kept.error.code === "sequence-conflict";
    dispatch({ type: "failed", reason: invalid ? "import-invalid" : "failed" });
    return;
  }
  dispatch({ type: "imported", courtSessionId });
}

/**
 * "Assumir o placar" (D5): the take-over with the stream screen 09a showed, then the import, and only
 * then the court. Every step reports to the reducer; nothing is logged.
 */
export async function runTakeover(
  deps: TakeoverDeps,
  target: TakeoverTarget,
  dispatch: Dispatch,
): Promise<void> {
  const account = await deps.account();
  const device = await deps.log.getDeviceId();
  if (account === null || !device.ok) {
    dispatch({ type: "failed", reason: account === null ? "no-account" : "failed" });
    return;
  }
  const { courtSessionId, currentBatch, eventCount } = target.summary;
  const body = {
    deviceId: device.value,
    expectedBatch: currentBatch,
    expectedEventCount: eventCount,
  };
  const ref = { ...target.origin, courtSessionId };
  const answer = await withRetryAfter(
    () => deps.api.takeOverCourt(ref, body, account.session),
    deps.wait,
  );
  if (!answer.ok) {
    dispatch(
      isStreamChanged(answer.error)
        ? { type: "stream-changed" }
        : { type: "failed", reason: takeoverFailureOf(answer.error) },
    );
    return;
  }
  if (!isPlausible(answer.value)) {
    dispatch({ type: "failed", reason: "import-invalid" });
    return;
  }
  await importAndKeep(
    deps,
    target,
    { account, deviceId: device.value, answer: answer.value },
    dispatch,
  );
}
