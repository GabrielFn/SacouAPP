import type { ApiError } from "../services/api/api-error";
import { isApiUrl } from "../services/api/api-config";
import { classifyFailure, isJson, isSuccess } from "../services/api/api-policy";
import { apiErr, apiOk, type ApiResult } from "../services/api/api-result";

// A type and not an interface: openapi-fetch takes an init with an index signature.
export type AuthInit = { readonly headers: Readonly<Record<string, string>> };

export interface FetchOutcome<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

export type Call<T> = (init: AuthInit) => Promise<FetchOutcome<T>>;

export const NOT_SENT: ApiError = { kind: "unexpected", status: 0 };

/** What one answer of the API means as a result: the body for the contract's success, an error otherwise. */
export function readOutcome<T>(
  baseUrl: string,
  outcome: FetchOutcome<T>,
  nowMs: number,
): ApiResult<T> {
  const { response } = outcome;
  const contentType = response.headers.get("content-type");
  // A transport that followed a redirect anyway: what came back is not the API's answer (D7).
  const moved = response.url !== "" && !isApiUrl(baseUrl, response.url);
  if (moved || response.type === "opaqueredirect") return apiErr(NOT_SENT);
  if (!isSuccess(response.status)) {
    const retryAfter = response.headers.get("retry-after");
    const raw = { status: response.status, contentType, retryAfter, body: outcome.error };
    return apiErr(classifyFailure(raw, nowMs));
  }
  if (outcome.data !== undefined && !isJson(contentType)) {
    return apiErr({ kind: "unexpected", status: response.status });
  }
  // The body was read by openapi-fetch for this operation's success status: its type is the contract's.
  return apiOk(outcome.data as T);
}

/** `token` is `null` only for the anonymous app config (ADR 0084): no Authorization header. */
export function authInit(token: string | null): AuthInit {
  const accept = { Accept: "application/json" };
  return { headers: token === null ? accept : { Authorization: `Bearer ${token}`, ...accept } };
}
