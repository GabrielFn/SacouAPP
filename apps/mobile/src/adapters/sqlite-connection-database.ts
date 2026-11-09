import type {
  SqlDatabase,
  SqlExecutor,
  SqlRow,
  SqlValue,
} from "../features/court/ports/sql-database";

/** The part of an `expo-sqlite` connection the court log uses (and a test can imitate). */
export interface SqliteConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync(sql: string, params: SqlValue[]): Promise<SqlRow[]>;
}

function executorOf(connection: SqliteConnection): SqlExecutor {
  return {
    exec: (sql) => connection.execAsync(sql),
    run: async (sql, params = []) => {
      await connection.runAsync(sql, [...params]);
    },
    getAll: (sql, params = []) => connection.getAllAsync(sql, [...params]),
  };
}

async function rollbackQuietly(connection: SqliteConnection): Promise<void> {
  try {
    await connection.execAsync("ROLLBACK");
  } catch {
    // The failure of the work is the one to report; a connection already closed has nothing to undo.
  }
}

async function inTransaction<T>(
  connection: SqliteConnection,
  work: (transaction: SqlExecutor) => Promise<T>,
): Promise<T> {
  await connection.execAsync("BEGIN IMMEDIATE");
  try {
    const result = await work(executorOf(connection));
    await connection.execAsync("COMMIT");
    return result;
  } catch (error) {
    await rollbackQuietly(connection);
    throw error;
  }
}

/**
 * The court log on the one main connection, whose `foreign_keys` and `synchronous` are the ones set
 * on opening (a second connection, as `withExclusiveTransactionAsync` opens, would not have them).
 * Everything runs through a queue, so a transaction never interleaves with another call.
 */
export function createSqliteConnectionDatabase(connection: SqliteConnection): SqlDatabase {
  const queue = { value: Promise.resolve() };
  const direct = executorOf(connection);

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.value.then(task);
    queue.value = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    exec: (sql) => enqueue(() => direct.exec(sql)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    getAll: (sql, params) => enqueue(() => direct.getAll(sql, params)),
    transaction: (work) => enqueue(() => inTransaction(connection, work)),
  };
}
