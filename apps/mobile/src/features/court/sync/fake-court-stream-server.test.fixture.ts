import type { EventEnvelope } from "@sacou/match-engine";

import type { ApiErrorCode } from "../../../api/generated/error-codes";
import type { ApiError, ProblemDetails } from "../../../services/api/api-error";
import { apiErr, apiOk, type ApiResult } from "../../../services/api/api-result";
import type {
  AppendCourtEventsAnswer,
  CourtStreamRef,
  SacouApi,
} from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { envelopeBytes } from "./chunk-for-upload";

const MAX_EVENTS = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_CONFLICT = 409;

export interface ReceivedRequest {
  readonly ref: CourtStreamRef;
  readonly envelopes: readonly EventEnvelope[];
  readonly account: SessionIdentity;
  readonly bytes: number;
}

interface Writer {
  readonly deviceId: string;
  readonly account: SessionIdentity;
}

/** What the next request gets instead of the rules: an error, or "stored but the answer was lost". */
type Fault =
  { readonly kind: "error"; readonly error: ApiError } | { readonly kind: "lose-answer" };

/**
 * Test-only: the stream of one court on the server, with the rules of ADR 0060 that the app meets
 * (idempotence by `eventId`, all or nothing, sequence per device, one writer) and injectable faults.
 */
export interface FakeCourtStreamServer {
  readonly api: Pick<SacouApi, "appendCourtEvents">;
  /** The stored stream, in order. */
  stored(): readonly EventEnvelope[];
  requests(): readonly ReceivedRequest[];
  /** The next requests, one per fault, get these instead of the rules. */
  failNext(...faults: readonly Fault[]): void;
  /** The next request waits until the returned function is called. */
  holdNext(): () => void;
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

export function createFakeCourtStreamServer(): FakeCourtStreamServer {
  const stream = { value: [] as readonly EventEnvelope[] };
  const writer = { value: null as Writer | null };
  const log = { value: [] as readonly ReceivedRequest[] };
  const faults = { value: [] as readonly Fault[] };
  const gate = { value: null as Promise<void> | null };

  function highest(deviceId: string): number {
    return stream.value
      .filter((event) => event.deviceId === deviceId)
      .reduce((top, event) => Math.max(top, event.sequence), 0);
  }

  function apply(
    envelopes: readonly EventEnvelope[],
    account: SessionIdentity,
  ): ApiResult<AppendCourtEventsAnswer> {
    if (!isWholeRequest(envelopes))
      return apiErr(problem(HTTP_BAD_REQUEST, "matches.batch-invalid"));
    const [first] = envelopes;
    if (first === undefined) return apiErr(problem(HTTP_BAD_REQUEST, "matches.batch-invalid"));
    const current = writer.value;
    if (current !== null && (current.deviceId !== first.deviceId || current.account !== account)) {
      return apiErr(problem(HTTP_CONFLICT, "matches.not-the-writer"));
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
    writer.value ??= { deviceId: first.deviceId, account };
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

  return {
    api: { appendCourtEvents: append },
    stored: () => stream.value,
    requests: () => log.value,
    failNext(...next) {
      faults.value = [...faults.value, ...next];
    },
    holdNext() {
      const release = { value: () => undefined as void };
      gate.value = new Promise<void>((resolve) => {
        release.value = resolve;
      });
      return () => {
        release.value();
      };
    },
    forgetLast(count) {
      stream.value = stream.value.slice(0, Math.max(0, stream.value.length - count));
    },
    giveToAnotherWriter() {
      writer.value = {
        deviceId: "another-device",
        account: Object.freeze({ opaque: Symbol("b") }),
      };
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
