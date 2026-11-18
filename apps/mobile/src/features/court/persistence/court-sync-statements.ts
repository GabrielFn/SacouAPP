import { err, ok } from "@sacou/volley-rules";

import {
  SYNC_HALT_CODES,
  type CourtLogResult,
  type SessionToSync,
  type SyncHaltCode,
  type TakeOverNotice,
} from "../ports/court-event-log";
import type { SqlExecutor, SqlRow } from "../ports/sql-database";
import {
  COPY_TO_REFUSED,
  DELETE_REFUSED_FROM_LOG,
  RAISE_ACKED_SEQUENCE,
  SELECT_SESSION,
  SELECT_SESSIONS_TO_SYNC,
  SET_ACKED_SEQUENCE,
  SET_SYNC_HALT,
  SET_TAKEN_OVER,
} from "./court-queries.data";
import { readIntegerColumn, readTextColumn } from "./row-mapping";

const HALT_CODES: ReadonlySet<string> = new Set(SYNC_HALT_CODES);

function isSyncHaltCode(value: string): value is SyncHaltCode {
  return HALT_CODES.has(value);
}

/** A stored halt outside the closed list is a broken file, not a code to show. */
export function readSyncHalt(row: SqlRow | undefined): CourtLogResult<SyncHaltCode | null> {
  const value = readTextColumn(row, "sync_halt");
  if (value === null) return ok(null);
  return isSyncHaltCode(value) ? ok(value) : err({ code: "corrupted-log" });
}

function isCursor(sequence: number): boolean {
  return Number.isSafeInteger(sequence) && sequence >= 0;
}

async function sessionExists(executor: SqlExecutor, courtSessionId: string): Promise<boolean> {
  const [row] = await executor.getAll(SELECT_SESSION, [courtSessionId]);
  return row !== undefined;
}

/** Runs `write` only on a session that exists, so a missing one is a code and not a silent no-op. */
async function onSession(
  executor: SqlExecutor,
  courtSessionId: string,
  write: () => Promise<void>,
): Promise<CourtLogResult<void>> {
  if (!(await sessionExists(executor, courtSessionId))) return err({ code: "session-not-found" });
  await write();
  return ok(undefined);
}

function toSessionToSync(row: SqlRow): readonly SessionToSync[] {
  const courtSessionId = readTextColumn(row, "court_session_id");
  const groupId = readTextColumn(row, "group_id");
  const roundId = readTextColumn(row, "round_id");
  if (courtSessionId === null || groupId === null || roundId === null) return [];
  return [{ courtSessionId, groupId, roundId, ownerKey: readTextColumn(row, "owner_key") }];
}

export async function findSessionsToSync(
  executor: SqlExecutor,
  deviceId: string,
): Promise<CourtLogResult<readonly SessionToSync[]>> {
  const rows = await executor.getAll(SELECT_SESSIONS_TO_SYNC, [deviceId]);
  return ok(rows.flatMap(toSessionToSync));
}

export function moveCursor(
  executor: SqlExecutor,
  courtSessionId: string,
  sequence: number,
  { onlyUp }: { readonly onlyUp: boolean },
): Promise<CourtLogResult<void>> {
  if (!isCursor(sequence)) return Promise.resolve(err({ code: "sequence-conflict" }));
  const statement = onlyUp ? RAISE_ACKED_SEQUENCE : SET_ACKED_SEQUENCE;
  return onSession(executor, courtSessionId, () =>
    executor.run(statement, [sequence, courtSessionId]),
  );
}

export function haltSync(
  executor: SqlExecutor,
  courtSessionId: string,
  code: SyncHaltCode,
): Promise<CourtLogResult<void>> {
  return onSession(executor, courtSessionId, () =>
    executor.run(SET_SYNC_HALT, [code, courtSessionId]),
  );
}

/** One transaction: the log goes back to what the server kept, and nothing is lost (D2, D6). */
export async function markTakenOver(
  transaction: SqlExecutor,
  courtSessionId: string,
  deviceId: string,
  { currentBatch, lastStoredSequence }: TakeOverNotice,
): Promise<CourtLogResult<void>> {
  const [row] = await transaction.getAll(SELECT_SESSION, [courtSessionId]);
  if (row === undefined) return err({ code: "session-not-found" });
  if (!isCursor(lastStoredSequence) || !Number.isSafeInteger(currentBatch) || currentBatch < 1) {
    return err({ code: "sequence-conflict" });
  }
  const scope = [courtSessionId, deviceId, lastStoredSequence];
  await transaction.run(COPY_TO_REFUSED, [currentBatch, ...scope]);
  await transaction.run(DELETE_REFUSED_FROM_LOG, scope);
  await transaction.run(SET_TAKEN_OVER, [currentBatch, lastStoredSequence, courtSessionId]);
  return ok(undefined);
}

/** The columns of the upload in a session row; `null` when the row is not a session of this schema. */
export function readSyncColumns(row: SqlRow | undefined): CourtLogResult<{
  ackedSequence: number;
  takenOverBatch: number | null;
  syncHalt: SyncHaltCode | null;
  fromRound: boolean;
  ownerKey: string | null;
}> {
  const ackedSequence = readIntegerColumn(row, "acked_sequence");
  const halt = readSyncHalt(row);
  if (ackedSequence === null || !halt.ok) return err({ code: "corrupted-log" });
  return ok({
    ackedSequence,
    takenOverBatch: readIntegerColumn(row, "taken_over_batch"),
    syncHalt: halt.value,
    fromRound: readTextColumn(row, "round_id") !== null,
    ownerKey: readTextColumn(row, "owner_key"),
  });
}
