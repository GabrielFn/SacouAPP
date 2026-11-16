import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Err } from "@sacou/volley-rules";

import type {
  CourtEventLog,
  CourtLogError,
  CourtLogResult,
  StoredCourtLog,
} from "../ports/court-event-log";
import type { IdGenerator } from "../../../services/id/id-generator";
import type { SqlDatabase, SqlExecutor, SqlRow } from "../ports/sql-database";
import { continuesLog, hasContiguousSequences } from "./append-rules";
import { FIRST_BATCH } from "./migrations.data";
import {
  CLOSED_STATUS,
  INSERT_DEVICE_ID,
  INSERT_EVENT,
  INSERT_SESSION,
  OPEN_STATUS,
  SELECT_ACTIVE_SESSION,
  SELECT_DEVICE_ID,
  SELECT_EVENTS,
  SELECT_MAX_POSITION,
  SELECT_MAX_SEQUENCE,
  SELECT_SESSION,
  UPDATE_SESSION_STATUS,
} from "./court-queries.data";
import {
  fromEventRow,
  isLowercaseUuid,
  readIntegerColumn,
  readTextColumn,
  toEventParams,
} from "./row-mapping";

const VALUE_COLUMN = "value";

/** The database may throw anything, so a failure becomes a code and never forwards its message. */
async function guarded<T>(work: () => Promise<CourtLogResult<T>>): Promise<CourtLogResult<T>> {
  try {
    return await work();
  } catch {
    return err({ code: "storage-failed" });
  }
}

async function readNumber(
  executor: SqlExecutor,
  sql: string,
  params: readonly string[],
): Promise<number> {
  const [row] = await executor.getAll(sql, params);
  const value = readIntegerColumn(row, VALUE_COLUMN);
  if (value === null) {
    throw new Error("expected a number");
  }
  return value;
}

async function readOrCreateDeviceId(
  transaction: SqlExecutor,
  ids: IdGenerator,
): Promise<CourtLogResult<string>> {
  const [row] = await transaction.getAll(SELECT_DEVICE_ID);
  const stored = readTextColumn(row, "device_id");
  if (stored !== null) {
    return isLowercaseUuid(stored) ? ok(stored) : err({ code: "corrupted-log" });
  }
  const created = ids.newId();
  if (!isLowercaseUuid(created)) {
    return err({ code: "storage-failed" });
  }
  await transaction.run(INSERT_DEVICE_ID, [created]);
  return ok(created);
}

async function readSession(
  executor: SqlExecutor,
  courtSessionId: string,
): Promise<SqlRow | undefined> {
  const [row] = await executor.getAll(SELECT_SESSION, [courtSessionId]);
  return row;
}

async function loadSession(
  transaction: SqlExecutor,
  courtSessionId: string,
): Promise<CourtLogResult<StoredCourtLog>> {
  const session = await readSession(transaction, courtSessionId);
  const batch = readIntegerColumn(session, "batch");
  if (batch === null) {
    return err({ code: "session-not-found" });
  }
  const rows = await transaction.getAll(SELECT_EVENTS, [courtSessionId]);
  const parsed = rows.map(fromEventRow);
  const failure = parsed.find((result): result is Err<CourtLogError> => !result.ok);
  if (failure !== undefined) {
    return failure;
  }
  const events = parsed.flatMap((result) => (result.ok ? [result.value] : []));
  if (!hasContiguousSequences(events)) {
    return err({ code: "corrupted-log" });
  }
  return ok({ batch, events });
}

async function appendEnvelopes(
  transaction: SqlExecutor,
  courtSessionId: string,
  envelopes: readonly EventEnvelope[],
): Promise<CourtLogResult<void>> {
  const batch = readIntegerColumn(await readSession(transaction, courtSessionId), "batch");
  if (batch === null) {
    return err({ code: "session-not-found" });
  }
  const [first] = envelopes;
  if (first === undefined) {
    return ok(undefined);
  }
  const lastSequence = await readNumber(transaction, SELECT_MAX_SEQUENCE, [
    courtSessionId,
    first.deviceId,
  ]);
  if (!continuesLog(envelopes, { courtSessionId, batch, lastSequence })) {
    return err({ code: "sequence-conflict" });
  }
  const lastPosition = await readNumber(transaction, SELECT_MAX_POSITION, [courtSessionId]);
  for (const [index, envelope] of envelopes.entries()) {
    await transaction.run(INSERT_EVENT, toEventParams(lastPosition + index + 1, envelope));
  }
  return ok(undefined);
}

async function setStatus(
  transaction: SqlExecutor,
  courtSessionId: string,
  status: string,
): Promise<CourtLogResult<void>> {
  if ((await readSession(transaction, courtSessionId)) === undefined) {
    return err({ code: "session-not-found" });
  }
  await transaction.run(UPDATE_SESSION_STATUS, [status, courtSessionId]);
  return ok(undefined);
}

/** The court log on SQLite. Every method is atomic: it commits whole or leaves the file as it was. */
export function createCourtEventRepository(database: SqlDatabase, ids: IdGenerator): CourtEventLog {
  return {
    getDeviceId: () => guarded(() => database.transaction((tx) => readOrCreateDeviceId(tx, ids))),
    openSession: (courtSessionId) =>
      guarded(async () => {
        await database.run(INSERT_SESSION, [courtSessionId, OPEN_STATUS, FIRST_BATCH]);
        return ok(undefined);
      }),
    findActiveSession: () =>
      guarded(async () => {
        const [row] = await database.getAll(SELECT_ACTIVE_SESSION, [OPEN_STATUS]);
        return ok(readTextColumn(row, "court_session_id"));
      }),
    closeSession: (courtSessionId) =>
      guarded(() => database.transaction((tx) => setStatus(tx, courtSessionId, CLOSED_STATUS))),
    load: (courtSessionId) =>
      guarded(() => database.transaction((tx) => loadSession(tx, courtSessionId))),
    append: (courtSessionId, envelopes) =>
      guarded(() => database.transaction((tx) => appendEnvelopes(tx, courtSessionId, envelopes))),
  };
}
