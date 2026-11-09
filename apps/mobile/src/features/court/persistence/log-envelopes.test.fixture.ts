import { parseEventEnvelope, type EventEnvelope } from "@sacou/match-engine";

import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { SqlDatabase } from "../ports/sql-database";
import { createCourtEventRepository } from "./court-event-repository";
import { migrateDatabase } from "./migrations";
import { openNodeSqliteDatabase, type NodeSqliteDatabase } from "./node-sqlite-database.test.fixture";

export const SESSION_A = "c0000000-0000-4000-8000-00000000000a";
export const SESSION_B = "c0000000-0000-4000-8000-00000000000b";
export const DEVICE = "d0000000-0000-4000-8000-000000000001";
const EVENT_ID_PREFIX = "e0000000-0000-4000-8000-";
const ID_DIGITS = 12;

export interface EnvelopeSetup {
  readonly courtSessionId?: string;
  readonly deviceId?: string;
  readonly sequence: number;
  readonly eventNumber?: number;
}

/** An event the repository can store: it does not replay, so any well-formed payload will do. */
export function makeEnvelope({
  courtSessionId = SESSION_A,
  deviceId = DEVICE,
  sequence,
  eventNumber = sequence,
}: EnvelopeSetup): EventEnvelope {
  const parsed = parseEventEnvelope({
    eventId: `${EVENT_ID_PREFIX}${String(eventNumber).padStart(ID_DIGITS, "0")}`,
    courtSessionId,
    deviceId,
    batch: 1,
    sequence,
    schemaVersion: 1,
    type: "PointScored",
    payload: { team: "a", setNumber: 1, matchId: "f0000000-0000-4000-8000-000000000001" },
  });
  if (!parsed.ok) {
    throw new Error(`invalid envelope: ${parsed.error.field}`);
  }
  return parsed.value;
}

export interface MigratedDatabase extends NodeSqliteDatabase {
  readonly database: SqlDatabase;
}

export async function openMigratedDatabase(): Promise<MigratedDatabase> {
  const sqlite = openNodeSqliteDatabase();
  const migrated = await migrateDatabase(sqlite.database);
  if (!migrated.ok) {
    throw new Error("migration failed");
  }
  return sqlite;
}

export function repositoryOn(sqlite: NodeSqliteDatabase) {
  return createCourtEventRepository(sqlite.database, createSequentialIdGenerator());
}
