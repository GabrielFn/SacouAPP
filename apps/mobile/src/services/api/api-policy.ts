import { apiErrorCodes, type ApiErrorCode } from "../../api/generated/error-codes";
import type { ApiError, ProblemDetails } from "./api-error";

/** What the client read from one HTTP answer, before deciding what it means (E4.2, D5). */
export interface RawAnswer {
  readonly status: number;
  readonly contentType: string | null;
  readonly retryAfter: string | null;
  readonly body: unknown;
}

const MS_PER_SECOND = 1_000;
/** A 503 or a 429 without a usable `Retry-After`, and the ceiling of any wait (D5). */
export const DEFAULT_RETRY_AFTER_MS = 30_000;
export const MAX_RETRY_AFTER_MS = 60_000;

const HTTP = {
  firstSuccess: 200,
  firstRedirect: 300,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  // `POST /v1/me` of an account deleted on the server (ADR 0056, D5).
  gone: 410,
  tooLarge: 413,
  // The content rules of the court stream (ADR 0060, D9).
  unprocessable: 422,
  // The per-user rate limit, whatever the code of its body (ADR 0062, D7).
  tooManyRequests: 429,
  unavailable: 503,
  // The native build is below the minimum, whatever the code of its body (ADR 0084).
  upgradeRequired: 426,
} as const;

const RULE_STATUSES: ReadonlySet<number> = new Set([
  HTTP.badRequest,
  HTTP.forbidden,
  HTTP.notFound,
  HTTP.conflict,
  HTTP.gone,
  HTTP.unprocessable,
]);
const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COUNT_FIELDS = ["expectedSequence", "currentBatch", "lastSequence"] as const;
const JSON_TYPES = /^application\/(?:problem\+)?json(?:;|$)/i;
const DELTA_SECONDS = /^[0-9]+$/;
// An HTTP date names the day and the month ("Tue, 10 Nov 2026 12:00:20 GMT"); a bare number is not one.
const HTTP_DATE = /^[A-Za-z]{3}, /;
const KNOWN_CODES: ReadonlySet<string> = new Set(apiErrorCodes);
const NOT_REGISTERED: ApiErrorCode = "identity.user-not-registered";

export function isSuccess(status: number): boolean {
  return status >= HTTP.firstSuccess && status < HTTP.firstRedirect;
}

export function isJson(contentType: string | null): boolean {
  return contentType !== null && JSON_TYPES.test(contentType);
}

function clamp(ms: number): number {
  return Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS);
}

/** `Retry-After` in seconds or as an HTTP date, read against the injected clock, capped at 60 s. */
export function parseRetryAfter(header: string | null, nowMs: number): number {
  const value = header?.trim() ?? "";
  if (DELTA_SECONDS.test(value)) return clamp(Number(value) * MS_PER_SECOND);
  const date = HTTP_DATE.test(value) ? Date.parse(value) : Number.NaN;
  return Number.isNaN(date) ? DEFAULT_RETRY_AFTER_MS : clamp(date - nowMs);
}

function isKnownCode(code: unknown): code is ApiErrorCode {
  return typeof code === "string" && KNOWN_CODES.has(code);
}

function codeOf(body: unknown): ApiErrorCode | null {
  if (typeof body !== "object" || body === null || !("code" in body)) return null;
  return isKnownCode(body.code) ? body.code : null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

type CountField = (typeof COUNT_FIELDS)[number];

function fieldOf(body: object, name: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(body, name)) return undefined;
  const value: unknown = Reflect.get(body, name);
  return value;
}

/** Only the fields of the closed list, each in its format; a value out of it is dropped (D4). */
export function detailsOf(body: unknown): ProblemDetails {
  if (typeof body !== "object" || body === null) return {};
  const counts = COUNT_FIELDS.reduce<Partial<Record<CountField, number>>>((found, name) => {
    const value = fieldOf(body, name);
    return isCount(value) ? { ...found, [name]: value } : found;
  }, {});
  const eventId = fieldOf(body, "eventId");
  return typeof eventId === "string" && LOWERCASE_UUID.test(eventId)
    ? { ...counts, eventId }
    : counts;
}

function ruleError(answer: RawAnswer): ApiError {
  // A code this app does not know (a newer API) is never shown nor kept as free text.
  const code = isJson(answer.contentType) ? codeOf(answer.body) : null;
  if (code === null) return { kind: "unexpected", status: answer.status };
  if (code === NOT_REGISTERED) return { kind: "not-registered" };
  const details = detailsOf(answer.body);
  return Object.keys(details).length === 0
    ? { kind: "problem", status: answer.status, code }
    : { kind: "problem", status: answer.status, code, details };
}

/** The error of a non-2xx answer. A redirect is `unexpected`: the client never follows one (D7). */
export function classifyFailure(answer: RawAnswer, nowMs: number): ApiError {
  switch (answer.status) {
    case HTTP.unauthorized:
      return { kind: "session-expired" };
    case HTTP.tooLarge:
      return { kind: "too-large" };
    case HTTP.tooManyRequests:
      return { kind: "rate-limited", retryAfterMs: parseRetryAfter(answer.retryAfter, nowMs) };
    case HTTP.unavailable:
      return { kind: "unavailable", retryAfterMs: parseRetryAfter(answer.retryAfter, nowMs) };
    case HTTP.upgradeRequired:
      return { kind: "app-outdated" };
    default:
      return RULE_STATUSES.has(answer.status)
        ? ruleError(answer)
        : { kind: "unexpected", status: answer.status };
  }
}

/** What the client has already done in this call, so each repetition happens at most once (D5). */
export interface AttemptState {
  readonly renewedToken: boolean;
  readonly signedIn: boolean;
}

export type NextStep = "renew-token" | "sign-in" | "give-up";

/**
 * The only repetitions of a call, mutations included: both answers come before any handler runs, so the
 * API has not acted yet (D5, "Ordem do 401").
 */
export function nextStep(error: ApiError, state: AttemptState): NextStep {
  if (error.kind === "session-expired" && !state.renewedToken) return "renew-token";
  if (error.kind === "not-registered" && !state.signedIn) return "sign-in";
  return "give-up";
}

/** A second `not-registered` after signing in is shown as the rule error it is, without a loop. */
export function finalError(error: ApiError): ApiError {
  return error.kind === "not-registered"
    ? { kind: "problem", status: HTTP.forbidden, code: NOT_REGISTERED }
    : error;
}

/** The 410 of `POST /v1/me` for an account deleted on the server (ADR 0056, D5). */
export function isAccountDeleted(error: ApiError): boolean {
  return error.kind === "problem" && error.code === "identity.account-deleted";
}
