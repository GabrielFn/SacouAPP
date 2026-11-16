import {
  CURRENT_EVENT_SCHEMA_VERSION,
  parseEventEnvelope,
  type EnvelopeError,
  type EventEnvelope,
} from "@sacou/match-engine";
import { ok, type Err, type Ok, type Result } from "@sacou/volley-rules";

import type { IdGenerator } from "../../../services/id/id-generator";

/** An event without an envelope, as the engine drafts it. */
export interface EventDraft {
  readonly type: string;
  readonly payload: unknown;
}

export interface EnvelopeContext {
  readonly courtSessionId: string;
  readonly deviceId: string;
  readonly batch: number;
  readonly firstSequence: number;
  readonly ids: IdGenerator;
}

function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Every envelope goes through the parser, so the log only receives what the replay will accept. */
export function buildEnvelopes(
  drafts: readonly EventDraft[],
  context: EnvelopeContext,
): Result<readonly EventEnvelope[], EnvelopeError> {
  const parsed = drafts.map((draft, index) =>
    parseEventEnvelope({
      eventId: context.ids.newId(),
      courtSessionId: context.courtSessionId,
      deviceId: context.deviceId,
      batch: context.batch,
      sequence: context.firstSequence + index,
      schemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
      type: draft.type,
      payload: draft.payload,
    }),
  );
  const failure = parsed.find(isErr);
  return failure ?? ok(parsed.filter(isOk).map((result) => result.value));
}
