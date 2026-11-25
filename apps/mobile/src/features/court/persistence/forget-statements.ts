import { ok } from "@sacou/volley-rules";

import type { CourtLogResult } from "../ports/court-event-log";
import type { SqlExecutor } from "../ports/sql-database";
import {
  COUNT_SESSIONS_OF_OWNER,
  DELETE_EVENTS_OF_OWNER,
  DELETE_REFUSED_OF_OWNER,
  DELETE_SESSIONS_OF_OWNER,
} from "./court-queries.data";
import { readIntegerColumn } from "./row-mapping";

const NOTHING_FORGOTTEN = 0;
const COUNT_COLUMN = "value";

/**
 * The sessions of a deleted account leave the device (E6.8), inside the transaction of the caller.
 * The children go first: their rows point at the session (`REFERENCES`).
 */
export async function forgetSessionsOf(
  transaction: SqlExecutor,
  ownerKey: string,
): Promise<CourtLogResult<number>> {
  const [row] = await transaction.getAll(COUNT_SESSIONS_OF_OWNER, [ownerKey]);
  const count = readIntegerColumn(row, COUNT_COLUMN) ?? NOTHING_FORGOTTEN;
  if (count === NOTHING_FORGOTTEN) return ok(NOTHING_FORGOTTEN);
  await transaction.run(DELETE_REFUSED_OF_OWNER, [ownerKey]);
  await transaction.run(DELETE_EVENTS_OF_OWNER, [ownerKey]);
  await transaction.run(DELETE_SESSIONS_OF_OWNER, [ownerKey]);
  return ok(count);
}
