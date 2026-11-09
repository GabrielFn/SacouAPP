/** Every statement of the court log. Values always travel as parameters, never inside the text. */
export const SELECT_DEVICE_ID = "SELECT device_id FROM device WHERE singleton = 1";
export const INSERT_DEVICE_ID = "INSERT INTO device (singleton, device_id) VALUES (1, ?)";

export const OPEN_STATUS = "open";
export const CLOSED_STATUS = "closed";

export const INSERT_SESSION =
  "INSERT OR IGNORE INTO court_sessions (court_session_id, status, batch) VALUES (?, ?, ?)";
export const SELECT_SESSION = "SELECT status, batch FROM court_sessions WHERE court_session_id = ?";
export const SELECT_ACTIVE_SESSION =
  "SELECT court_session_id FROM court_sessions WHERE status = ? ORDER BY rowid DESC LIMIT 1";
export const UPDATE_SESSION_STATUS = "UPDATE court_sessions SET status = ? WHERE court_session_id = ?";

export const SELECT_MAX_POSITION =
  "SELECT COALESCE(MAX(position), 0) AS value FROM court_events WHERE court_session_id = ?";
export const SELECT_MAX_SEQUENCE =
  "SELECT COALESCE(MAX(sequence), 0) AS value FROM court_events WHERE court_session_id = ? AND device_id = ?";

export const SELECT_EVENTS =
  "SELECT event_id, court_session_id, device_id, batch, sequence, schema_version, type, payload FROM court_events WHERE court_session_id = ? ORDER BY position";
export const INSERT_EVENT =
  "INSERT INTO court_events (court_session_id, position, event_id, device_id, batch, sequence, schema_version, type, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
