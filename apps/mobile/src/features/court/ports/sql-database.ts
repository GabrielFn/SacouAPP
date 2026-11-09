/** A value SQLite stores in a column of a STRICT table of the court log. */
export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

/** Always called with parameters: SQL text is never built from values. */
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  getAll(sql: string, params?: readonly SqlValue[]): Promise<readonly SqlRow[]>;
}

export interface SqlDatabase extends SqlExecutor {
  /** One at a time, with the other calls queued behind it: commits when `work` resolves and rolls everything back when it rejects. */
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
}
