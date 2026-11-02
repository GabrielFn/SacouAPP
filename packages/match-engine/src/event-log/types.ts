import type { Result } from "@sacou/volley-rules";

import type {
  ENVELOPE_FIELDS,
  ENVELOPE_ROOT_FIELD,
  UNKNOWN_ENVELOPE_FIELD,
} from "./constants.data.js";

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface EventEnvelope {
  readonly eventId: string;
  readonly courtSessionId: string;
  /** A random UUID per installation, generated outside the engine; never a hardware identifier. */
  readonly deviceId: string;
  /** The write batch in the stream, stamped when the event is stored; a resend keeps it. */
  readonly batch: number;
  /** Grows per device in the stream; a gap is not an error here. */
  readonly sequence: number;
  readonly schemaVersion: number;
  readonly type: string;
  readonly payload: JsonObject;
}

export type EnvelopeFieldName = (typeof ENVELOPE_FIELDS)[number];

/** Carries only a field name from the schema, never a received key or value. */
export interface EnvelopeError {
  readonly code: "invalid-envelope";
  readonly field: EnvelopeFieldName | typeof ENVELOPE_ROOT_FIELD | typeof UNKNOWN_ENVELOPE_FIELD;
}

/** Carries only a code: the rejected event is identified by the replay. */
export interface EventRejection {
  readonly code: "event-rejected";
}

/** Pure: applies the recorded result without recalculating rules and never mutates the state. */
export type EventApplier<S> = (state: S, event: EventEnvelope) => Result<S, EventRejection>;

export interface ReplayConfig<S> {
  readonly courtSessionId: string;
  readonly initialState: S;
  readonly appliers: ReadonlyMap<string, EventApplier<S>>;
}

export interface ReplayedState<S> {
  readonly state: S;
  /** The events whose effects are in the state, in canonical order. Never lists a `RevertedTo`. */
  readonly activeEventIds: readonly string[];
}

export type ReplayErrorCode =
  | "stream-mismatch"
  | "event-id-conflict"
  | "sequence-conflict"
  | "unsupported-schema-version"
  | "unknown-event-type"
  | "event-rejected"
  | "invalid-revert-target";

export interface ReplayError {
  readonly code: ReplayErrorCode;
  readonly eventId: string;
}
