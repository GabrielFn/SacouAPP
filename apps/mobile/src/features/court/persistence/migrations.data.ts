/**
 * Ordered steps of the local schema: step N takes `user_version` from N - 1 to N. Only ids and
 * numbers are stored, never a name (dados-pessoais.md). A published step is never edited.
 */
export const MIGRATION_STEPS: readonly string[] = [
  `CREATE TABLE device (
     singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
     device_id TEXT NOT NULL
   ) STRICT;
   CREATE TABLE court_sessions (
     court_session_id TEXT PRIMARY KEY,
     status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
     batch INTEGER NOT NULL CHECK (batch >= 1)
   ) STRICT;
   CREATE TABLE court_events (
     court_session_id TEXT NOT NULL REFERENCES court_sessions (court_session_id),
     position INTEGER NOT NULL,
     event_id TEXT NOT NULL UNIQUE,
     device_id TEXT NOT NULL,
     batch INTEGER NOT NULL,
     sequence INTEGER NOT NULL,
     schema_version INTEGER NOT NULL,
     type TEXT NOT NULL,
     payload TEXT NOT NULL,
     PRIMARY KEY (court_session_id, position),
     UNIQUE (court_session_id, batch, sequence, device_id)
   ) STRICT;`,
];

export const USER_VERSION_PRAGMA = "user_version";
export const DATABASE_FILE_NAME = "sacou.db";
export const FIRST_BATCH = 1;
export const FIRST_SEQUENCE = 1;
