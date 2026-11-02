export const CURRENT_EVENT_SCHEMA_VERSION = 1;

export const SUPPORTED_EVENT_SCHEMA_VERSIONS: readonly number[] = [CURRENT_EVENT_SCHEMA_VERSION];

export const REVERTED_TO_EVENT_TYPE = "RevertedTo";

/** The closed schema of the envelope: anything else is rejected, so nothing personal can slip in. */
export const ENVELOPE_FIELDS = [
  "eventId",
  "courtSessionId",
  "deviceId",
  "batch",
  "sequence",
  "schemaVersion",
  "type",
  "payload",
] as const;

/** Reported when the input as a whole is not an envelope object. */
export const ENVELOPE_ROOT_FIELD = "envelope";

/** Reported instead of the name of an unknown field, which is received data and may be personal. */
export const UNKNOWN_ENVELOPE_FIELD = "unknown-field";

export const MAX_EVENT_TYPE_LENGTH = 64;

/** Levels of nested objects and arrays in a payload, counting the payload itself. */
export const MAX_PAYLOAD_DEPTH = 32;

/** JSON values in a payload, counting the payload itself and each visit to a shared reference. */
export const MAX_PAYLOAD_NODES = 4096;
