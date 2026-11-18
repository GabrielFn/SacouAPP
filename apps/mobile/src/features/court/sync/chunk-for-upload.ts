import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import { MAX_ENVELOPE_BYTES, MAX_EVENTS_PER_REQUEST, MAX_REQUEST_BYTES } from "./sync.data";

export { MAX_ENVELOPE_BYTES, MAX_EVENTS_PER_REQUEST, MAX_REQUEST_BYTES } from "./sync.data";

// `{"events":[` and `]}` around the envelopes, and one comma between two of them.
const BODY_FRAME_BYTES = '{"events":[]}'.length;
const SEPARATOR_BYTES = 1;
const UTF8 = new TextEncoder();

/** The size in UTF-8 of a text, as the server counts the body. */
export function utf8Length(text: string): number {
  return UTF8.encode(text).length;
}

export function envelopeBytes(envelope: EventEnvelope): number {
  return utf8Length(JSON.stringify(envelope));
}

export type ChunkError = "event-too-large";

/**
 * The pending events cut in requests, in order: each one with at most `maxEvents` events and
 * `MAX_REQUEST_BYTES` of body. Fails closed when an envelope alone is over `MAX_ENVELOPE_BYTES`.
 */
export function chunkForUpload(
  pending: readonly EventEnvelope[],
  maxEvents: number = MAX_EVENTS_PER_REQUEST,
): Result<readonly (readonly EventEnvelope[])[], ChunkError> {
  const sizes = pending.map(envelopeBytes);
  if (sizes.some((size) => size > MAX_ENVELOPE_BYTES)) return err("event-too-large");
  const limit = Math.max(1, Math.min(maxEvents, MAX_EVENTS_PER_REQUEST));
  const start = { chunk: [] as readonly EventEnvelope[], bytes: BODY_FRAME_BYTES };
  const cut = pending.reduce(
    (state, envelope, index) => {
      const size = (sizes[index] ?? 0) + (state.current.chunk.length === 0 ? 0 : SEPARATOR_BYTES);
      const fits =
        state.current.chunk.length < limit && state.current.bytes + size <= MAX_REQUEST_BYTES;
      if (fits) {
        return {
          done: state.done,
          current: { chunk: [...state.current.chunk, envelope], bytes: state.current.bytes + size },
        };
      }
      return {
        done: [...state.done, state.current.chunk],
        current: { chunk: [envelope], bytes: BODY_FRAME_BYTES + (sizes[index] ?? 0) },
      };
    },
    { done: [] as readonly (readonly EventEnvelope[])[], current: start },
  );
  return ok(cut.current.chunk.length === 0 ? cut.done : [...cut.done, cut.current.chunk]);
}
