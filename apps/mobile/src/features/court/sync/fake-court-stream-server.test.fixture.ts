import type { EventEnvelope } from "@sacou/match-engine";

import type { ApiErrorCode } from "../../../api/generated/error-codes";
import type { ApiError, ProblemDetails } from "../../../services/api/api-error";
import { apiErr, apiOk, type ApiResult } from "../../../services/api/api-result";
import type {
  AppendCourtEventsAnswer,
  CourtEventsPage,
  CourtSessionSummary,
  CourtStreamRef,
  SacouApi,
  TakeOverCourtAnswer,
  TakeOverCourtBody,
} from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { envelopeBytes } from "./chunk-for-upload";

const MAX_EVENTS = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;
const PAGE_SIZE = 500;
const WRITER_SINCE = "2026-11-18T21:14:00.000Z";
const WRITER_MEMBER = "a0000000-0000-4000-8000-000000000001";

export interface ReceivedRequest {
  readonly ref: CourtStreamRef;
  readonly envelopes: readonly EventEnvelope[];
  readonly account: SessionIdentity;
  readonly bytes: number;
}

interface Writer {
  readonly deviceId: string;
  readonly account: SessionIdentity;
  readonly batch: number;
  readonly eventsBefore: number;
}

export type TakeoverServerApi = Pick<
  SacouApi,
  "appendCourtEvents" | "getCourtSession" | "takeOverCourt" | "listCourtEvents"
>;

/** What the next request gets instead of the rules: an error, or "stored but the answer was lost". */
type Fault =
  { readonly kind: "error"; readonly error: ApiError } | { readonly kind: "lose-answer" };

/**
 * Test-only: the stream of one court on the server, with the rules of ADR 0060 that the app meets
 * (idempotence by `eventId`, all or nothing, sequence per device, one writer) and injectable faults.
 */
export interface FakeCourtStreamServer {
  readonly api: TakeoverServerApi;
  /** The size of the pages of `listCourtEvents`. */
  setPageSize(size: number): void;
  /** Each page goes through this before it leaves: a test breaks the stream here. */
  tamperPages(change: (page: CourtEventsPage, after: number) => CourtEventsPage): void;
  /** The stored stream, in order. */
  stored(): readonly EventEnvelope[];
  requests(): readonly ReceivedRequest[];
  /** The next requests, one per fault, get these instead of the rules. */
  failNext(...faults: readonly Fault[]): void;
  /** The next request waits until the returned function is called. */
  holdNext(): () => void;
  /** The next page of the stream waits until the returned function is called. */
  holdNextPage(): () => void;
  /** As if the server lost its last `count` events (a restored backup). */
  forgetLast(count: number): void;
  /** Another phone writes the stream now. */
  giveToAnotherWriter(): void;
}

export const loseAnswer: Fault = { kind: "lose-answer" };

export function errorFault(error: ApiError): Fault {
  return { kind: "error", error };
}

function problem(status: number, code: ApiErrorCode, details?: ProblemDetails): ApiError {
  return details === undefined
    ? { kind: "problem", status, code }
    : { kind: "problem", status, code, details };
}

function isWholeRequest(envelopes: readonly EventEnvelope[]): boolean {
  const [first] = envelopes;
  return (
    first !== undefined &&
    envelopes.length <= MAX_EVENTS &&
    envelopes.every(
      (envelope, index) =>
        envelope.deviceId === first.deviceId &&
        envelope.batch === first.batch &&
        envelope.sequence === first.sequence + index,
    )
  );
}

/**
 * Bodies as a broken server could send them (`null`, a text, an array): the HTTP adapter would hand
 * them on typed as the contract says, so the test does the same.
 */
export function brokenPage(body: unknown): CourtEventsPage {
  return body as CourtEventsPage;
}

export function brokenTakeOverAnswer(body: unknown): TakeOverCourtAnswer {
  return body as TakeOverCourtAnswer;
}

export function createFakeCourtStreamServer(): FakeCourtStreamServer {
  const stream = { value: [] as readonly EventEnvelope[] };
  const writers = { value: [] as readonly Writer[] };
  const log = { value: [] as readonly ReceivedRequest[] };
  const faults = { value: [] as readonly Fault[] };
  const gate = { value: null as Promise<void> | null };
  const streamId = { value: null as string | null };
  const pageSize = { value: PAGE_SIZE };
  const tamper = {
    value: (page: CourtEventsPage, _after: number): CourtEventsPage => page,
  };
  const pageGate = { value: null as Promise<void> | null };

  function highest(deviceId: string): number {
    return stream.value
      .filter((event) => event.deviceId === deviceId)
      .reduce((top, event) => Math.max(top, event.sequence), 0);
  }

  /** `lastSequence` only for a pair that wrote an earlier batch (ADR 0063, D8). */
  function notTheWriter(
    currentBatch: number,
    deviceId: string,
    account: SessionIdentity,
  ): ApiError {
    const wrote = writers.value.some(
      (other) => other.deviceId === deviceId && other.account === account,
    );
    return problem(
      HTTP_CONFLICT,
      "matches.not-the-writer",
      wrote ? { currentBatch, lastSequence: highest(deviceId) } : { currentBatch },
    );
  }

  function apply(
    envelopes: readonly EventEnvelope[],
    account: SessionIdentity,
  ): ApiResult<AppendCourtEventsAnswer> {
    if (!isWholeRequest(envelopes))
      return apiErr(problem(HTTP_BAD_REQUEST, "matches.batch-invalid"));
    const [first] = envelopes;
    if (first === undefined) return apiErr(problem(HTTP_BAD_REQUEST, "matches.batch-invalid"));
    const current = writers.value.at(-1) ?? null;
    if (current !== null && (current.deviceId !== first.deviceId || current.account !== account)) {
      return apiErr(notTheWriter(current.batch, first.deviceId, account));
    }
    const known = new Set(stream.value.map((event) => event.eventId));
    const fresh = envelopes.filter((envelope) => !known.has(envelope.eventId));
    const [firstNew] = fresh;
    const expected = highest(first.deviceId) + 1;
    if (firstNew !== undefined && firstNew.sequence > expected) {
      return apiErr(problem(HTTP_CONFLICT, "matches.sequence-gap", { expectedSequence: expected }));
    }
    if (firstNew !== undefined && firstNew.sequence < expected) {
      return apiErr(problem(HTTP_CONFLICT, "matches.sequence-conflict"));
    }
    if (current === null) {
      writers.value = [{ deviceId: first.deviceId, account, batch: 1, eventsBefore: 0 }];
      streamId.value = first.courtSessionId;
    }
    stream.value = [...stream.value, ...fresh];
    return apiOk({ lastSequence: highest(first.deviceId), stored: fresh.length });
  }

  async function append(
    ref: CourtStreamRef,
    envelopes: readonly EventEnvelope[],
    account: SessionIdentity,
  ): Promise<ApiResult<AppendCourtEventsAnswer>> {
    const bytes = JSON.stringify({ events: envelopes }).length;
    log.value = [...log.value, { ref, envelopes, account, bytes }];
    const waiting = gate.value;
    gate.value = null;
    if (waiting !== null) await waiting;
    const [fault, ...rest] = faults.value;
    faults.value = rest;
    if (fault?.kind === "error") return apiErr(fault.error);
    const answer = apply(envelopes, account);
    return fault?.kind === "lose-answer" ? apiErr({ kind: "offline" }) : answer;
  }

  function summary(): ApiResult<CourtSessionSummary> {
    const current = writers.value.at(-1);
    if (current === undefined || streamId.value === null) {
      return apiErr(problem(HTTP_NOT_FOUND, "matches.court-session-not-found"));
    }
    return apiOk({
      courtSessionId: streamId.value,
      currentBatch: current.batch,
      eventCount: stream.value.length,
      writer: { memberId: WRITER_MEMBER, since: WRITER_SINCE },
      lastEventAt: null,
      scoreboard: null,
    });
  }

  function takeOver(
    body: TakeOverCourtBody,
    account: SessionIdentity,
  ): ApiResult<TakeOverCourtAnswer> {
    const current = writers.value.at(-1);
    if (current === undefined) {
      return apiErr(problem(HTTP_NOT_FOUND, "matches.court-session-not-found"));
    }
    const lastSequence = highest(body.deviceId);
    if (current.deviceId === body.deviceId && current.account === account) {
      return apiOk({ batch: current.batch, eventsBefore: current.eventsBefore, lastSequence });
    }
    if (body.expectedBatch !== current.batch || body.expectedEventCount !== stream.value.length) {
      return apiErr(problem(HTTP_CONFLICT, "matches.stream-changed"));
    }
    const next = {
      deviceId: body.deviceId,
      account,
      batch: current.batch + 1,
      eventsBefore: stream.value.length,
    };
    writers.value = [...writers.value, next];
    return apiOk({ batch: next.batch, eventsBefore: next.eventsBefore, lastSequence });
  }

  async function listEvents(after: number): Promise<ApiResult<CourtEventsPage>> {
    const waiting = pageGate.value;
    pageGate.value = null;
    if (waiting !== null) await waiting;
    const events = stream.value.slice(after, after + pageSize.value).map((event) => ({ ...event }));
    const page = { events, lastPosition: after + events.length, eventCount: stream.value.length };
    return apiOk(tamper.value(page, after));
  }

  /** A gate the next call waits on, and the function that opens it. */
  function newGate(): { readonly promise: Promise<void>; readonly open: () => void } {
    const release: { value: () => void } = { value: () => undefined };
    const promise = new Promise<void>((resolve) => {
      release.value = resolve;
    });
    return {
      promise,
      open: () => {
        release.value();
      },
    };
  }

  return {
    api: {
      appendCourtEvents: append,
      getCourtSession: () => Promise.resolve(summary()),
      takeOverCourt: (_, body, account) => Promise.resolve(takeOver(body, account)),
      listCourtEvents: (_, after) => listEvents(after),
    },
    setPageSize(size) {
      pageSize.value = size;
    },
    tamperPages(change) {
      tamper.value = change;
    },
    stored: () => stream.value,
    requests: () => log.value,
    failNext(...next) {
      faults.value = [...faults.value, ...next];
    },
    holdNext() {
      const next = newGate();
      gate.value = next.promise;
      return next.open;
    },
    holdNextPage() {
      const next = newGate();
      pageGate.value = next.promise;
      return next.open;
    },
    forgetLast(count) {
      stream.value = stream.value.slice(0, Math.max(0, stream.value.length - count));
    },
    giveToAnotherWriter() {
      writers.value = [
        ...writers.value,
        {
          deviceId: "another-device",
          account: Object.freeze({ opaque: Symbol("b") }),
          batch: writers.value.length + 1,
          eventsBefore: stream.value.length,
        },
      ];
    },
  };
}

/** The size the server counts, for the assertions of the chunks. */
export function bodyBytes(envelopes: readonly EventEnvelope[]): number {
  return envelopes.reduce(
    (total, envelope) => total + envelopeBytes(envelope) + 1,
    '{"events":[]}'.length - 1,
  );
}
