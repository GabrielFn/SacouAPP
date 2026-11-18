import { parseEventEnvelope, type EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtStreamRef, SacouApi } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { hasContiguousSequences } from "../persistence/append-rules";
import type { CourtReplayer } from "../session/court-replay";
import { isRecord, takeoverFailureOf, withRetryAfter } from "./api-calls";
import type { TakeoverFailure } from "./takeover.reducer";

const BYTES_PER_MIB = 1_048_576;
const MAX_STREAM_MIB = 8;
/** The ceilings of a stream on the server (ADR 0060): beyond them the import fails closed. */
export const MAX_IMPORTED_EVENTS = 20_000;
export const MAX_IMPORTED_BYTES = MAX_STREAM_MIB * BYTES_PER_MIB;

export interface ImportDeps {
  readonly api: Pick<SacouApi, "listCourtEvents">;
  readonly replayer: CourtReplayer;
  readonly wait: (ms: number) => Promise<void>;
}

export interface ImportRequest {
  readonly ref: CourtStreamRef;
  /** The events the stream had when this device took it over: exactly these are read. */
  readonly eventsBefore: number;
  /** The account that took the court over: every page is read only with its token (ADR 0067, D8). */
  readonly account: SessionIdentity;
  readonly onProgress: (imported: number) => void;
}

interface Page {
  readonly events: readonly unknown[];
  readonly lastPosition: number;
}

interface Collected {
  readonly raw: readonly unknown[];
  readonly bytes: number;
}

type Read<T> = Result<T, TakeoverFailure>;

const INVALID: Read<never> = err("import-invalid");

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** A page is read as untrusted input: it must start right after `after` and say where it ends. */
function readPage(value: unknown, after: number): Page | null {
  if (!isRecord(value)) return null;
  const { events, lastPosition } = value;
  if (!Array.isArray(events) || events.length === 0 || !isCount(lastPosition)) return null;
  const list: readonly unknown[] = events;
  return lastPosition === after + list.length ? { events: list, lastPosition } : null;
}

const utf8 = new TextEncoder();

/** The size the server counts: UTF-8 bytes, so an accented text weighs what it weighs on the wire. */
function sizeOf(raw: unknown): number {
  return utf8.encode(JSON.stringify(raw)).byteLength;
}

async function readPages(
  deps: ImportDeps,
  request: ImportRequest,
  collected: Collected,
): Promise<Read<readonly unknown[]>> {
  const after = collected.raw.length;
  if (after >= request.eventsBefore) return ok(collected.raw.slice(0, request.eventsBefore));
  const answer = await withRetryAfter(
    () => deps.api.listCourtEvents(request.ref, after, request.account),
    deps.wait,
  );
  if (!answer.ok) return err(takeoverFailureOf(answer.error));
  const body: unknown = answer.value;
  const page = readPage(body, after);
  if (page === null) return INVALID;
  const bytes = collected.bytes + page.events.reduce<number>((sum, raw) => sum + sizeOf(raw), 0);
  if (bytes > MAX_IMPORTED_BYTES) return INVALID;
  const raw = [...collected.raw, ...page.events];
  request.onProgress(Math.min(raw.length, request.eventsBefore));
  return readPages(deps, request, { raw, bytes });
}

/** Each envelope through the parser of the log, all of this stream, in order, and a replay that works. */
function proveStream(
  deps: ImportDeps,
  courtSessionId: string,
  raw: readonly unknown[],
): Read<readonly EventEnvelope[]> {
  const parsed = raw.map((item) => parseEventEnvelope(item));
  const events = parsed.flatMap((result) => (result.ok ? [result.value] : []));
  const whole =
    events.length === raw.length &&
    events.every((event) => event.courtSessionId === courtSessionId) &&
    hasContiguousSequences(events);
  if (!whole) return INVALID;
  return deps.replayer.replay(courtSessionId, events).ok ? ok(events) : INVALID;
}

/**
 * Reads the stream of the server page by page, up to the events it had at the take-over (D5, item 3).
 * Nothing is written here: the caller keeps the result only when every check passed.
 */
export async function readServerStream(
  deps: ImportDeps,
  request: ImportRequest,
): Promise<Read<readonly EventEnvelope[]>> {
  const { eventsBefore } = request;
  if (!isCount(eventsBefore) || eventsBefore > MAX_IMPORTED_EVENTS) return INVALID;
  const raw = await readPages(deps, request, { raw: [], bytes: 0 });
  return raw.ok ? proveStream(deps, request.ref.courtSessionId, raw.value) : raw;
}
