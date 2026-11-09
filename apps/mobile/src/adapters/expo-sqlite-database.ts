import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import type {
  SqlDatabase,
  SqlExecutor,
  SqlRow,
  SqlValue,
} from "../features/court/ports/sql-database";

/** Durable also if the phone powers off, and the foreign keys of the court log enforced. */
const OPEN_PRAGMAS = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  PRAGMA foreign_keys = ON;
`;

type Queryable = Pick<SQLiteDatabase, "execAsync" | "runAsync" | "getAllAsync">;

function executorOf(connection: Queryable): SqlExecutor {
  return {
    exec: (sql) => connection.execAsync(sql),
    run: async (sql, params = []) => {
      await connection.runAsync(sql, [...params]);
    },
    getAll: async (sql, params = []) => {
      const rows = await connection.getAllAsync<SqlRow>(sql, [...params]);
      return rows;
    },
  };
}

/** Result of a transaction, carried out of the callback that `expo-sqlite` wants to return void. */
interface Outcome<T> {
  value?: T;
}

export async function openExpoSqliteDatabase(fileName: string): Promise<SqlDatabase> {
  const connection = await openDatabaseAsync(fileName);
  await connection.execAsync(OPEN_PRAGMAS);
  return {
    ...executorOf(connection),
    async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
      const outcome: Outcome<T> = {};
      await connection.withExclusiveTransactionAsync(async (transaction) => {
        outcome.value = await work(executorOf(transaction));
      });
      return outcome.value as T;
    },
  };
}

export type { SqlValue };
