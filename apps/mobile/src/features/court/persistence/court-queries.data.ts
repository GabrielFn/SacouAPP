/** Every statement of the court log. Values always travel as parameters, never inside the text. */
export const SELECT_DEVICE_ID = "SELECT device_id FROM device WHERE singleton = 1";
export const INSERT_DEVICE_ID = "INSERT INTO device (singleton, device_id) VALUES (1, ?)";

export const OPEN_STATUS = "open";
export const CLOSED_STATUS = "closed";

export const INSERT_SESSION =
  "INSERT OR IGNORE INTO court_sessions (court_session_id, status, batch, group_id, round_id, owner_key, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
export const SELECT_SESSION =
  "SELECT status, batch, acked_sequence, taken_over_batch, sync_halt, round_id, owner_key FROM court_sessions WHERE court_session_id = ?";
export const SELECT_SESSION_ORIGIN =
  "SELECT group_id, round_id FROM court_sessions WHERE court_session_id = ?";
export const SELECT_SESSION_OPENED_AT =
  "SELECT opened_at FROM court_sessions WHERE court_session_id = ?";
export const SELECT_ACTIVE_SESSION =
  "SELECT court_session_id FROM court_sessions WHERE status = ? ORDER BY rowid DESC LIMIT 1";
export const SELECT_OPEN_SESSION_OF_ROUND =
  "SELECT court_session_id FROM court_sessions WHERE status = ? AND round_id = ? ORDER BY rowid DESC LIMIT 1";
export const UPDATE_SESSION_STATUS =
  "UPDATE court_sessions SET status = ? WHERE court_session_id = ?";

export const SELECT_MAX_POSITION =
  "SELECT COALESCE(MAX(position), 0) AS value FROM court_events WHERE court_session_id = ?";
export const SELECT_MAX_SEQUENCE =
  "SELECT COALESCE(MAX(sequence), 0) AS value FROM court_events WHERE court_session_id = ? AND device_id = ?";

export const SELECT_EVENTS =
  "SELECT event_id, court_session_id, device_id, batch, sequence, schema_version, type, payload FROM court_events WHERE court_session_id = ? ORDER BY position";
export const INSERT_EVENT =
  "INSERT INTO court_events (court_session_id, position, event_id, device_id, batch, sequence, schema_version, type, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

// The upload to the server (E4.11, ADR 0067). What is pending is derived here, never stored.
export const SELECT_SESSIONS_TO_SYNC = `SELECT s.court_session_id, s.group_id, s.round_id, s.owner_key
  FROM court_sessions s
  WHERE s.group_id IS NOT NULL AND s.round_id IS NOT NULL
    AND s.sync_halt IS NULL AND s.taken_over_batch IS NULL
    AND EXISTS (SELECT 1 FROM court_events e
      WHERE e.court_session_id = s.court_session_id AND e.device_id = ?
        AND e.batch = s.batch AND e.sequence > s.acked_sequence)
  ORDER BY s.rowid`;
export const RAISE_ACKED_SEQUENCE =
  "UPDATE court_sessions SET acked_sequence = MAX(acked_sequence, ?) WHERE court_session_id = ?";
export const SET_ACKED_SEQUENCE =
  "UPDATE court_sessions SET acked_sequence = ? WHERE court_session_id = ?";
/** One placeholder per code of `HALTS_LIFTED_ON_OPEN`. */
export const LIFT_HALTS_ON_OPEN =
  "UPDATE court_sessions SET sync_halt = NULL WHERE sync_halt IN (?, ?)";
export const SET_SYNC_HALT = "UPDATE court_sessions SET sync_halt = ? WHERE court_session_id = ?";
export const SET_TAKEN_OVER =
  "UPDATE court_sessions SET taken_over_batch = ?, acked_sequence = ? WHERE court_session_id = ?";
export const COPY_TO_REFUSED = `INSERT INTO court_refused_events
  (court_session_id, position, event_id, device_id, batch, sequence, schema_version, type, payload, refused_at_batch)
  SELECT court_session_id, position, event_id, device_id, batch, sequence, schema_version, type, payload, ?
  FROM court_events WHERE court_session_id = ? AND device_id = ? AND sequence > ?`;
export const DELETE_REFUSED_FROM_LOG =
  "DELETE FROM court_events WHERE court_session_id = ? AND device_id = ? AND sequence > ?";

// Screen 09c (E4.11, D6): the events of this device the server left out, in the order of the log.
export const SELECT_REFUSED = `SELECT event_id, court_session_id, device_id, batch, sequence, schema_version, type, payload, seen
  FROM court_refused_events WHERE court_session_id = ? ORDER BY position`;
export const MARK_REFUSED_SEEN =
  "UPDATE court_refused_events SET seen = 1 WHERE court_session_id = ?";

// Taking the court over (E4.11, D5): the stream of the server replaces the local log in one transaction.
export const SELECT_OPEN_SESSIONS_OF_ROUND = `SELECT court_session_id, acked_sequence, taken_over_batch
  FROM court_sessions WHERE status = ? AND round_id = ? AND court_session_id <> ?`;
export const DELETE_REFUSED_OF_SESSION =
  "DELETE FROM court_refused_events WHERE court_session_id = ?";
export const DELETE_EVENTS_OF_SESSION = "DELETE FROM court_events WHERE court_session_id = ?";
export const SET_IMPORTED_SESSION = `UPDATE court_sessions SET status = ?, batch = ?, acked_sequence = ?,
  taken_over_batch = NULL, sync_halt = NULL, group_id = ?, round_id = ?, owner_key = ?
  WHERE court_session_id = ?`;

// The deletion of an account (E6.8): its sessions leave the device, the children before the parent.
const SESSIONS_OF_OWNER = "SELECT court_session_id FROM court_sessions WHERE owner_key = ?";
export const COUNT_SESSIONS_OF_OWNER =
  "SELECT COUNT(*) AS value FROM court_sessions WHERE owner_key = ?";
export const DELETE_REFUSED_OF_OWNER = `DELETE FROM court_refused_events WHERE court_session_id IN (${SESSIONS_OF_OWNER})`;
export const DELETE_EVENTS_OF_OWNER = `DELETE FROM court_events WHERE court_session_id IN (${SESSIONS_OF_OWNER})`;
export const DELETE_SESSIONS_OF_OWNER = "DELETE FROM court_sessions WHERE owner_key = ?";
