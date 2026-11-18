import type { EventEnvelope } from "@sacou/match-engine";

import type { SacouApi } from "../../../services/api/sacou-api";
import { highestSequence } from "../persistence/append-rules";
import type { CourtLogResult, CourtEventLog, SessionToSync } from "../ports/court-event-log";
import type { CourtAccountRef } from "../ports/court-account";
import { chunkForUpload } from "./chunk-for-upload";
import { pendingEvents } from "./pending-events";
import { decideSync, type SentRequest, type SyncDecision } from "./sync-policy";
import { MAX_EVENTS_PER_REQUEST, SHRINK_FACTOR } from "./sync.data";

/** How one request (or its follow-ups) ended, for the loop. */
export type UploadOutcome =
  /** Something changed in the log (cursor, halt, take-over): the next pass sees it. */
  | { readonly type: "progress" }
  | { readonly type: "nothing" }
  | { readonly type: "retry"; readonly afterMs: number | null }
  | { readonly type: "account-changed" };

export interface UploadDeps {
  readonly log: CourtEventLog;
  readonly api: Pick<SacouApi, "appendCourtEvents">;
  /** The loop wrote a halt or a take-over in this session. */
  readonly onSessionChanged: (courtSessionId: string) => void;
}

interface UploadContext extends UploadDeps {
  readonly target: SessionToSync;
  readonly account: CourtAccountRef;
  readonly deviceId: string;
  /** True while `account` is still the one signed in, read right before each request (D8). */
  readonly isAccountCurrent: () => Promise<boolean>;
}

const ACCOUNT_CHANGED: Awaited<ReturnType<SacouApi["appendCourtEvents"]>> = {
  ok: false,
  error: { kind: "account-changed" },
};

interface Pending {
  readonly events: readonly EventEnvelope[];
  readonly batch: number;
  readonly ackedSequence: number;
  readonly lastOwnSequence: number;
}

const PROGRESS: UploadOutcome = { type: "progress" };
const NOTHING: UploadOutcome = { type: "nothing" };
const BACKOFF: UploadOutcome = { type: "retry", afterMs: null };
const REFUSED: SyncDecision = { type: "halt", code: "event-refused" };

function written(result: CourtLogResult<void>): UploadOutcome {
  return result.ok ? PROGRESS : BACKOFF;
}

async function stopped(
  context: UploadContext,
  write: () => Promise<CourtLogResult<void>>,
): Promise<UploadOutcome> {
  const outcome = written(await write());
  context.onSessionChanged(context.target.courtSessionId);
  return outcome;
}

async function send(
  context: UploadContext,
  chunk: readonly EventEnvelope[],
): Promise<Awaited<ReturnType<SacouApi["appendCourtEvents"]>>> {
  const { groupId, roundId, courtSessionId } = context.target;
  if (!(await context.isAccountCurrent())) return ACCOUNT_CHANGED;
  return context.api.appendCourtEvents(
    { groupId, roundId, courtSessionId },
    chunk,
    context.account.session,
  );
}

async function apply(
  context: UploadContext,
  decision: SyncDecision,
  sent: SentRequest,
): Promise<UploadOutcome> {
  const { log, target, deviceId } = context;
  const id = target.courtSessionId;
  switch (decision.type) {
    case "acknowledge":
      return written(await log.markAcknowledged(id, decision.sequence));
    case "rewind":
      return written(await log.rewindAcknowledged(id, decision.sequence));
    case "take-over":
      return stopped(context, () => log.markTakenOver(id, deviceId, decision.notice));
    case "halt":
      return stopped(context, () => log.haltSync(id, decision.code));
    case "send-prefix":
      return sendPrefix(context, { ...sent, chunk: sent.chunk.slice(0, decision.count) });
    case "shrink":
      return NOTHING;
    case "retry":
      return { type: "retry", afterMs: decision.afterMs };
    case "account-changed":
      return { type: "account-changed" };
  }
}

/** The events before the refused one go in alone; then the session stops (D4, 422). */
async function sendPrefix(context: UploadContext, sent: SentRequest): Promise<UploadOutcome> {
  const decision = decideSync(await send(context, sent.chunk), sent);
  // A 413 on the prefix would send the whole request, and the 422, again on every pass (R4).
  if (decision.type === "shrink") return apply(context, REFUSED, sent);
  if (decision.type !== "acknowledge") return apply(context, decision, sent);
  const outcome = await apply(context, decision, sent);
  if (outcome.type !== "progress") return outcome;
  return apply(context, REFUSED, sent);
}

async function sendFirstChunk(
  context: UploadContext,
  pending: Pending,
  maxEvents: number,
): Promise<UploadOutcome> {
  const chunks = chunkForUpload(pending.events, maxEvents);
  const [chunk] = chunks.ok ? chunks.value : [];
  if (!chunks.ok) {
    return stopped(context, () =>
      context.log.haltSync(context.target.courtSessionId, "event-too-large"),
    );
  }
  if (chunk === undefined) return NOTHING;
  const sent: SentRequest = { ...pending, chunk };
  const decision = decideSync(await send(context, chunk), sent);
  if (decision.type !== "shrink") return apply(context, decision, sent);
  if (chunk.length === 1) {
    return apply(context, { type: "halt", code: "event-too-large" }, sent);
  }
  return sendFirstChunk(context, pending, Math.ceil(chunk.length / SHRINK_FACTOR));
}

/** Sends the next request of one session and writes what the answer means in its log. */
export async function uploadSession(context: UploadContext): Promise<UploadOutcome> {
  const loaded = await context.log.load(context.target.courtSessionId);
  if (!loaded.ok) return BACKOFF;
  const { events, batch, ackedSequence } = loaded.value;
  const pending: Pending = {
    events: pendingEvents(events, { deviceId: context.deviceId, batch, ackedSequence }),
    batch,
    ackedSequence,
    lastOwnSequence: highestSequence(events, context.deviceId),
  };
  return sendFirstChunk(context, pending, MAX_EVENTS_PER_REQUEST);
}
