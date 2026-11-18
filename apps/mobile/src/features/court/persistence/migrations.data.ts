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
  // The origin of a court session (E4.7, D8): only IDs, null in the sample sessions.
  `ALTER TABLE court_sessions ADD COLUMN group_id TEXT;
   ALTER TABLE court_sessions ADD COLUMN round_id TEXT;`,
  // The upload to the server (E4.11, ADR 0067): the cursor of what the server confirmed, the stop of a
  // refused stream, the batch of the writer that took over, the key of the account that opened the
  // session (a hash, never the UID) and the events of this device the server left out.
  `ALTER TABLE court_sessions ADD COLUMN acked_sequence INTEGER NOT NULL DEFAULT 0 CHECK (acked_sequence >= 0);
   ALTER TABLE court_sessions ADD COLUMN taken_over_batch INTEGER CHECK (taken_over_batch >= 1);
   ALTER TABLE court_sessions ADD COLUMN sync_halt TEXT CHECK (sync_halt IN ('stream-diverged', 'round-canceled', 'event-refused', 'no-permission', 'not-found', 'event-too-large', 'client-bug'));
   ALTER TABLE court_sessions ADD COLUMN owner_key TEXT;
   CREATE TABLE court_refused_events (
     court_session_id TEXT NOT NULL REFERENCES court_sessions (court_session_id),
     position INTEGER NOT NULL,
     event_id TEXT NOT NULL UNIQUE,
     device_id TEXT NOT NULL,
     batch INTEGER NOT NULL,
     sequence INTEGER NOT NULL,
     schema_version INTEGER NOT NULL,
     type TEXT NOT NULL,
     payload TEXT NOT NULL,
     refused_at_batch INTEGER NOT NULL,
     seen INTEGER NOT NULL DEFAULT 0 CHECK (seen IN (0, 1)),
     PRIMARY KEY (court_session_id, position)
   ) STRICT;`,
];

export const USER_VERSION_PRAGMA = "user_version";
export const FIRST_BATCH = 1;
