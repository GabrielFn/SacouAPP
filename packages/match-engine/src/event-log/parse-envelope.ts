import { err, ok, type Result } from "@sacou/volley-rules";

import {
  ENVELOPE_FIELDS,
  ENVELOPE_ROOT_FIELD,
  MAX_EVENT_TYPE_LENGTH,
  MAX_PAYLOAD_DEPTH,
  MAX_PAYLOAD_NODES,
  UNKNOWN_ENVELOPE_FIELD,
} from "./constants.data.js";
import { isUuid } from "./is-uuid.js";
import type {
  EnvelopeError,
  EnvelopeFieldName,
  EventEnvelope,
  JsonObject,
  JsonValue,
} from "./types.js";

const KNOWN_FIELDS: ReadonlySet<string | symbol> = new Set(ENVELOPE_FIELDS);

type RawEnvelope = Readonly<Partial<Record<EnvelopeFieldName, unknown>>>;
type JsonEntry = readonly [string, JsonValue];

/** The one mutable value of the copy: threading it through would make the copy quadratic. */
interface NodeBudget {
  remaining: number;
}

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

function spendNode(budget: NodeBudget): boolean {
  if (budget.remaining <= 0) {
    return false;
  }
  budget.remaining -= 1;
  return true;
}

function cloneArray(
  value: readonly unknown[],
  depth: number,
  budget: NodeBudget,
): readonly JsonValue[] | undefined {
  // Checked first: Array.from would walk every slot of a huge, empty array before any item counts.
  if (value.length > budget.remaining) {
    return undefined;
  }
  // Array.from turns holes into undefined, so a sparse array is rejected.
  const items = Array.from(value, (item) => cloneJsonValue(item, depth + 1, budget));
  return items.every(isDefined) ? Object.freeze(items) : undefined;
}

function cloneObject(
  value: Readonly<Record<string, unknown>>,
  depth: number,
  budget: NodeBudget,
): JsonObject | undefined {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length > budget.remaining || !ownKeys.every((key) => typeof key === "string")) {
    return undefined;
  }
  // Sorted by UTF-16 code unit, so a resend with its keys in another order yields the same text.
  const entries = Object.keys(value)
    .sort()
    .map((key) => [key, cloneJsonValue(value[key], depth + 1, budget)] as const);
  // Object.fromEntries defines own properties, so a "__proto__" key cannot reach the prototype.
  return entries.every(isCompleteEntry) ? Object.freeze(Object.fromEntries(entries)) : undefined;
}

function copyValue(value: unknown, depth: number, budget: NodeBudget): JsonValue | undefined {
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
    return cloneArray(value as readonly unknown[], depth, budget);
  }
  return isPlainObject(value) ? cloneObject(value, depth, budget) : undefined;
}

/** Returns a frozen copy, or undefined for anything that JSON cannot represent or the limits bar. */
function cloneJsonValue(value: unknown, depth: number, budget: NodeBudget): JsonValue | undefined {
  if (!spendNode(budget)) {
    return undefined;
  }
  const copy = copyValue(value, depth, budget);
  if (copy === undefined) {
    // Any failure ends the copy, so a rejected payload costs no further work on its siblings.
    budget.remaining = 0;
  }
  return copy;
}

function clonePayload(value: unknown): JsonObject | undefined {
  const budget: NodeBudget = { remaining: MAX_PAYLOAD_NODES };
  return isPlainObject(value) && spendNode(budget) ? cloneObject(value, 1, budget) : undefined;
}

/** Own properties only: with a polluted Object.prototype, a missing field must stay missing. */
function readOwn(raw: RawEnvelope, field: EnvelopeFieldName): unknown {
  return Object.hasOwn(raw, field) ? raw[field] : undefined;
}

function parseFields(raw: RawEnvelope): Result<EventEnvelope, EnvelopeError> {
  // Each field is read once here, so a getter cannot change the value after the check.
  const eventId = readOwn(raw, "eventId");
  if (!isUuid(eventId)) return invalid("eventId");
  const courtSessionId = readOwn(raw, "courtSessionId");
  if (!isUuid(courtSessionId)) return invalid("courtSessionId");
  const deviceId = readOwn(raw, "deviceId");
  if (!isUuid(deviceId)) return invalid("deviceId");
  const batch = readOwn(raw, "batch");
  if (!isPositiveSafeInteger(batch)) return invalid("batch");
  const sequence = readOwn(raw, "sequence");
  if (!isPositiveSafeInteger(sequence)) return invalid("sequence");
  const schemaVersion = readOwn(raw, "schemaVersion");
  if (!isPositiveSafeInteger(schemaVersion)) return invalid("schemaVersion");
  const type = readOwn(raw, "type");
  if (!isEventType(type)) return invalid("type");
  const payload = clonePayload(readOwn(raw, "payload"));
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
    // Input that is not from JSON.parse can run code (getters, proxies, custom iterators).
    return invalid(ENVELOPE_ROOT_FIELD);
  }
}
