import { err, ok, type Result } from "@sacou/volley-rules";

import {
  ENVELOPE_FIELDS,
  ENVELOPE_ROOT_FIELD,
  MAX_EVENT_TYPE_LENGTH,
  MAX_PAYLOAD_DEPTH,
  UNKNOWN_ENVELOPE_FIELD,
} from "./constants.data.js";
import type {
  EnvelopeError,
  EnvelopeFieldName,
  EventEnvelope,
  JsonObject,
  JsonValue,
} from "./types.js";

const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const KNOWN_FIELDS: ReadonlySet<string | symbol> = new Set(ENVELOPE_FIELDS);

type RawEnvelope = Readonly<Partial<Record<EnvelopeFieldName, unknown>>>;
type JsonEntry = readonly [string, JsonValue];

function invalid(field: EnvelopeError["field"]): Result<never, EnvelopeError> {
  return err({ code: "invalid-envelope", field });
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && LOWERCASE_UUID.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isEventType(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= MAX_EVENT_TYPE_LENGTH;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isCompleteEntry(entry: readonly [string, JsonValue | undefined]): entry is JsonEntry {
  return entry[1] !== undefined;
}

function cloneArray(value: readonly unknown[], depth: number): readonly JsonValue[] | undefined {
  // Array.from turns holes into undefined, so a sparse array is rejected.
  const items = Array.from(value, (item) => cloneJsonValue(item, depth + 1));
  return items.every(isDefined) ? Object.freeze(items) : undefined;
}

function cloneObject(
  value: Readonly<Record<string, unknown>>,
  depth: number,
): JsonObject | undefined {
  if (!Reflect.ownKeys(value).every((key) => typeof key === "string")) {
    return undefined;
  }
  const entries = Object.entries(value).map(
    ([key, item]) => [key, cloneJsonValue(item, depth + 1)] as const,
  );
  // Object.fromEntries defines own properties, so a "__proto__" key cannot reach the prototype.
  return entries.every(isCompleteEntry) ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

/** Returns a frozen copy, or undefined for anything that JSON cannot represent. */
function cloneJsonValue(value: unknown, depth: number): JsonValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (depth > MAX_PAYLOAD_DEPTH) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return cloneArray(value as readonly unknown[], depth);
  }
  return isPlainObject(value) ? cloneObject(value, depth) : undefined;
}

function clonePayload(value: unknown): JsonObject | undefined {
  return isPlainObject(value) ? cloneObject(value, 1) : undefined;
}

function parseFields(raw: RawEnvelope): Result<EventEnvelope, EnvelopeError> {
  // Each field is read once here, so a getter cannot change the value after the check.
  const { eventId, courtSessionId, deviceId, batch, sequence, schemaVersion, type } = raw;
  if (!isUuid(eventId)) return invalid("eventId");
  if (!isUuid(courtSessionId)) return invalid("courtSessionId");
  if (!isUuid(deviceId)) return invalid("deviceId");
  if (!isPositiveSafeInteger(batch)) return invalid("batch");
  if (!isPositiveSafeInteger(sequence)) return invalid("sequence");
  if (!isPositiveSafeInteger(schemaVersion)) return invalid("schemaVersion");
  if (!isEventType(type)) return invalid("type");
  const payload = clonePayload(raw.payload);
  if (payload === undefined) return invalid("payload");
  return ok(
    Object.freeze({
      eventId,
      courtSessionId,
      deviceId,
      batch,
      sequence,
      schemaVersion,
      type,
      payload,
    }),
  );
}

/** Validates untrusted input. Fails closed: errors name a schema field and never echo the input. */
export function parseEventEnvelope(raw: unknown): Result<EventEnvelope, EnvelopeError> {
  try {
    if (!isPlainObject(raw)) {
      return invalid(ENVELOPE_ROOT_FIELD);
    }
    const hasOnlyKnownFields = Reflect.ownKeys(raw).every((key) => KNOWN_FIELDS.has(key));
    return hasOnlyKnownFields ? parseFields(raw) : invalid(UNKNOWN_ENVELOPE_FIELD);
  } catch {
    // Only a getter or a proxy can throw here, and JSON.parse produces neither.
    return invalid(ENVELOPE_ROOT_FIELD);
  }
}
