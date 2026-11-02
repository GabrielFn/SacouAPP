import { err, ok, type Result } from "@sacou/volley-rules";

import { ENVELOPE_FIELDS, SUPPORTED_EVENT_SCHEMA_VERSIONS } from "./constants.data.js";
import type {
  EventEnvelope,
  JsonObject,
  JsonValue,
  ReplayError,
  ReplayErrorCode,
} from "./types.js";

function failure(code: ReplayErrorCode, event: EventEnvelope): Result<never, ReplayError> {
  return err({ code, eventId: event.eventId });
}

/** By UTF-16 code unit, like string.CompareOrdinal in C#; never by locale. */
function compareText(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareCanonical(left: EventEnvelope, right: EventEnvelope): number {
  return (
    left.batch - right.batch ||
    left.sequence - right.sequence ||
    compareText(left.deviceId, right.deviceId) ||
    compareText(left.eventId, right.eventId)
  );
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !isJsonArray(value);
}

function arraysEqual(left: readonly JsonValue[], right: readonly JsonValue[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return other !== undefined && jsonEquals(item, other);
    })
  );
}

function objectsEqual(left: JsonObject, right: JsonObject): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => {
      const [item, other] = [left[key], right[key]];
      // hasOwn: a missing "__proto__" key would otherwise read the prototype of the object.
      return (
        Object.hasOwn(right, key) &&
        item !== undefined &&
        other !== undefined &&
        jsonEquals(item, other)
      );
    })
  );
}

/** Structural, regardless of key order. Recursive: safe only on parser output, as replay requires. */
function jsonEquals(left: JsonValue, right: JsonValue): boolean {
  if (isJsonArray(left)) {
    return isJsonArray(right) && arraysEqual(left, right);
  }
  if (isJsonObject(left)) {
    return isJsonObject(right) && objectsEqual(left, right);
  }
  return left === right;
}

function haveSameContent(left: EventEnvelope, right: EventEnvelope): boolean {
  return ENVELOPE_FIELDS.every((field) => jsonEquals(left[field], right[field]));
}

function haveSameOrderKey(left: EventEnvelope, right: EventEnvelope): boolean {
  return (
    left.batch === right.batch &&
    left.sequence === right.sequence &&
    left.deviceId === right.deviceId
  );
}

function firstById(sorted: readonly EventEnvelope[]): ReadonlyMap<string, EventEnvelope> {
  // A later entry replaces an earlier one, so reversing keeps the first in canonical order.
  return new Map([...sorted].reverse().map((event) => [event.eventId, event] as const));
}

/**
 * Sorts a copy of the log, drops exact resends and checks the whole log, inactive events included.
 * Checks go by code and then in canonical order, so the outcome never depends on arrival order.
 */
export function normalizeLog(
  events: readonly EventEnvelope[],
  courtSessionId: string,
): Result<readonly EventEnvelope[], ReplayError> {
  const sorted = [...events].sort(compareCanonical);

  const foreign = sorted.find((event) => event.courtSessionId !== courtSessionId);
  if (foreign !== undefined) {
    return failure("stream-mismatch", foreign);
  }

  const firsts = firstById(sorted);
  const conflicting = sorted.find((event) => {
    const first = firsts.get(event.eventId);
    return first !== undefined && !haveSameContent(first, event);
  });
  if (conflicting !== undefined) {
    return failure("event-id-conflict", conflicting);
  }

  const unique = sorted.filter((event) => firsts.get(event.eventId) === event);
  const clashing = unique.find((event, index) => {
    const previous = unique[index - 1];
    return previous !== undefined && haveSameOrderKey(previous, event);
  });
  if (clashing !== undefined) {
    return failure("sequence-conflict", clashing);
  }

  const unsupported = unique.find(
    (event) => !SUPPORTED_EVENT_SCHEMA_VERSIONS.includes(event.schemaVersion),
  );
  return unsupported === undefined
    ? ok(unique)
    : failure("unsupported-schema-version", unsupported);
}
