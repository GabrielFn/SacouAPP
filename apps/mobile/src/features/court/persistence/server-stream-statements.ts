import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Err } from "@sacou/volley-rules";

import type { CourtLogError, CourtLogResult, ServerStreamImport } from "../ports/court-event-log";
import type { SqlExecutor } from "../ports/sql-database";
import { hasContiguousSequences, highestSequence } from "./append-rules";
import {
  CLOSED_STATUS,
  DELETE_EVENTS_OF_SESSION,
  DELETE_REFUSED_OF_SESSION,
  INSERT_EVENT,
  INSERT_SESSION,
  MARK_REFUSED_SEEN,
  OPEN_STATUS,
  SELECT_OPEN_SESSIONS_OF_ROUND,
  SELECT_REFUSED,
  SELECT_SESSION,
  SET_IMPORTED_SESSION,
  UPDATE_SESSION_STATUS,
} from "./court-queries.data";
import { markTakenOver } from "./court-sync-statements";
import { fromEventRow, readIntegerColumn, readTextColumn, toEventParams } from "./row-mapping";

const SEEN = 1;

export interface RefusedLog {
  readonly refused: readonly EventEnvelope[];
  readonly refusedUnseen: boolean;
}

/** The refused events go through the same parser as the log: a broken row fails the whole load. */
export async function loadRefused(
  executor: SqlExecutor,
  courtSessionId: string,
): Promise<CourtLogResult<RefusedLog>> {
  const rows = await executor.getAll(SELECT_REFUSED, [courtSessionId]);
  const parsed = rows.map(fromEventRow);
  const failure = parsed.find((result): result is Err<CourtLogError> => !result.ok);
  if (failure !== undefined) return failure;
  return ok({
    refused: parsed.flatMap((result) => (result.ok ? [result.value] : [])),
    refusedUnseen: rows.some((row) => readIntegerColumn(row, "seen") !== SEEN),
  });
}

export async function markRefusedSeen(
  executor: SqlExecutor,
  courtSessionId: string,
): Promise<CourtLogResult<void>> {
  const [session] = await executor.getAll(SELECT_SESSION, [courtSessionId]);
  if (session === undefined) return err({ code: "session-not-found" });
  await executor.run(MARK_REFUSED_SEEN, [courtSessionId]);
  return ok(undefined);
}

/** The repository checks again what the import already proved: a stream it can keep (D5). */
function isWholeStream(stream: ServerStreamImport): boolean {
  const { events, courtSessionId, deviceId, batch, lastSequence } = stream;
  return (
    Number.isSafeInteger(batch) &&
    batch >= 1 &&
    events.every((event) => event.courtSessionId === courtSessionId) &&
    hasContiguousSequences(events) &&
    highestSequence(events, deviceId) === lastSequence
  );
}

/**
 * What this device wrote and the server does not hold leaves the log, as on a `not-the-writer`: the
 * points stay among the refused ones, and the session no longer sends them.
 */
async function leaveUnsent(
  transaction: SqlExecutor,
  courtSessionId: string,
  deviceId: string,
  batch: number,
): Promise<CourtLogResult<void>> {
  const [row] = await transaction.getAll(SELECT_SESSION, [courtSessionId]);
  const acked = readIntegerColumn(row, "acked_sequence");
  if (row === undefined || readIntegerColumn(row, "taken_over_batch") !== null)
    return ok(undefined);
  if (acked === null) return err({ code: "corrupted-log" });
  return markTakenOver(transaction, courtSessionId, deviceId, {
    currentBatch: batch,
    lastStoredSequence: acked,
  });
}

/** The session that stays open, and who writes it: the other open sessions of its round leave. */
interface KeptSession {
  readonly courtSessionId: string;
  readonly roundId: string;
  readonly deviceId: string;
  readonly batch: number;
}

/** The other open sessions of the round: their unsent points leave, and they are closed (D5, item 4). */
async function closeOtherSessionsOfRound(
  transaction: SqlExecutor,
  kept: KeptSession,
): Promise<CourtLogResult<void>> {
  const rows = await transaction.getAll(SELECT_OPEN_SESSIONS_OF_ROUND, [
    OPEN_STATUS,
    kept.roundId,
    kept.courtSessionId,
  ]);
  for (const row of rows) {
    const id = readTextColumn(row, "court_session_id");
    if (id === null) return err({ code: "corrupted-log" });
    const left = await leaveUnsent(transaction, id, kept.deviceId, kept.batch);
    if (!left.ok) return left;
    await transaction.run(UPDATE_SESSION_STATUS, [CLOSED_STATUS, id]);
  }
  return ok(undefined);
}

/**
 * One transaction (D5): the session ends with exactly the stream of the server, writing again. Its
 * refused events are dropped: they were shown (09c) before "Assumir de volta", and this device goes on
 * with the same sequences in the new batch. What it had not sent (the session of another account, D8)
 * is dropped with them: only that account could ever send it, and the session is no longer its.
 */
export async function replaceWithServerStream(
  transaction: SqlExecutor,
  stream: ServerStreamImport,
): Promise<CourtLogResult<void>> {
  if (!isWholeStream(stream)) return err({ code: "sequence-conflict" });
  const { courtSessionId, origin, batch, lastSequence, events } = stream;
  const closed = await closeOtherSessionsOfRound(transaction, {
    courtSessionId,
    roundId: origin.roundId,
    deviceId: stream.deviceId,
    batch,
  });
  if (!closed.ok) return closed;
  await transaction.run(DELETE_REFUSED_OF_SESSION, [courtSessionId]);
  await transaction.run(DELETE_EVENTS_OF_SESSION, [courtSessionId]);
  await transaction.run(INSERT_SESSION, [
    courtSessionId,
    OPEN_STATUS,
    batch,
    origin.groupId,
    origin.roundId,
    origin.ownerKey,
    // When the stream was opened on the other phone is not known here: the round end stays unknown.
    null,
  ]);
  await transaction.run(SET_IMPORTED_SESSION, [
    OPEN_STATUS,
    batch,
    lastSequence,
    origin.groupId,
    origin.roundId,
    origin.ownerKey,
    courtSessionId,
  ]);
  for (const [index, envelope] of events.entries()) {
    await transaction.run(INSERT_EVENT, toEventParams(index + 1, envelope));
  }
  return ok(undefined);
}

/**
 * One transaction (R98): the pair the server kept as the writer opens its own session again, with
 * every event it holds, sent or not. The other open sessions of the round close as on an import.
 */
export async function reopenSession(
  transaction: SqlExecutor,
  courtSessionId: string,
  deviceId: string,
): Promise<CourtLogResult<void>> {
  const [row] = await transaction.getAll(SELECT_SESSION, [courtSessionId]);
  const batch = readIntegerColumn(row, "batch");
  const roundId = readTextColumn(row, "round_id");
  if (row === undefined || batch === null) return err({ code: "session-not-found" });
  if (readIntegerColumn(row, "taken_over_batch") !== null) return err({ code: "taken-over" });
  if (roundId === null) return err({ code: "corrupted-log" });
  const closed = await closeOtherSessionsOfRound(transaction, {
    courtSessionId,
    roundId,
    deviceId,
    batch,
  });
  if (!closed.ok) return closed;
  await transaction.run(UPDATE_SESSION_STATUS, [OPEN_STATUS, courtSessionId]);
  return ok(undefined);
}
