/** The numbers of the court upload (ADR 0067), in one data file. */
const KIB = 1_024;

/** The server takes 1 to 200 events per request (ADR 0060, D5). */
export const MAX_EVENTS_PER_REQUEST = 200;
/** Below the 256 KiB of the server, so 200 envelopes of the worst size never make a 413 (D3). */
export const MAX_REQUEST_BYTES = 192 * KIB;
/** The ceiling of one envelope on the server: one above it is never sent. */
export const MAX_ENVELOPE_BYTES = 16 * KIB;
/** A 413 cuts the request in this many parts. */
export const SHRINK_FACTOR = 2;

/** The waits after a failure of the network or of the server: 2, 4, 8, 16, 32 and then 60 s (D3). */
export const FIRST_BACKOFF_MS = 2_000;
export const MAX_BACKOFF_MS = 60_000;
export const BACKOFF_GROWTH = 2;
/** ±20%, so two phones that failed together do not try again together. */
export const BACKOFF_JITTER = 0.2;
/** The jitter goes from `1 - BACKOFF_JITTER` to `1 + BACKOFF_JITTER`: twice the jitter wide. */
export const BACKOFF_JITTER_SPAN = 2 * BACKOFF_JITTER;
