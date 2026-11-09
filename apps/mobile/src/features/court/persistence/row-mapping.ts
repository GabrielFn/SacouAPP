import { parseEventEnvelope, type EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtLogError } from "../ports/court-event-log";
import type { SqlRow, SqlValue } from "../ports/sql-database";

const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const CORRUPTED: CourtLogError = { code: "corrupted-log" };

export function isLowercaseUuid(value: unknown): value is string {
  return typeof value === "string" && LOWERCASE_UUID.test(value);
}

/** The parameters of `INSERT_EVENT`. The payload is already canonical: the parser sorted its keys. */
export function toEventParams(position: number, envelope: EventEnvelope): readonly SqlValue[] {
  return [
    envelope.courtSessionId,
    position,
    envelope.eventId,
    envelope.deviceId,
    envelope.batch,
    envelope.sequence,
    envelope.schemaVersion,
    envelope.type,
    JSON.stringify(envelope.payload),
  ];
}

function parsePayload(text: SqlValue | undefined): unknown {
  if (typeof text !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** A stored row goes through the same parser as an event received from outside. */
export function fromEventRow(row: SqlRow): Result<EventEnvelope, CourtLogError> {
  const parsed = parseEventEnvelope({
    eventId: row["event_id"],
    courtSessionId: row["court_session_id"],
    deviceId: row["device_id"],
    batch: row["batch"],
    sequence: row["sequence"],
    schemaVersion: row["schema_version"],
    type: row["type"],
    payload: parsePayload(row["payload"]),
  });
  return parsed.ok ? ok(parsed.value) : err(CORRUPTED);
}

export function readIntegerColumn(row: SqlRow | undefined, column: string): number | null {
  const value = row?.[column];
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

export function readTextColumn(row: SqlRow | undefined, column: string): string | null {
  const value = row?.[column];
  return typeof value === "string" ? value : null;
}
