import type { ApiErrorCode } from "../../api/generated/error-codes";

/**
 * Every way a call to the API can fail, as the app reads it (E4.2, D5). It never carries a raw body, a
 * header or a URL, so it can be logged, shown or kept by the query cache without leaking the ID token.
 */
export type ApiError =
  | { readonly kind: "problem"; readonly status: number; readonly code: ApiErrorCode }
  | { readonly kind: "session-expired" }
  | { readonly kind: "not-registered" }
  | { readonly kind: "too-large" }
  | { readonly kind: "rate-limited"; readonly retryAfterMs: number }
  | { readonly kind: "unavailable"; readonly retryAfterMs: number }
  | { readonly kind: "offline" }
  | { readonly kind: "unexpected"; readonly status: number };

export type ApiErrorKind = ApiError["kind"];

/**
 * What the query functions throw, because that is the contract of TanStack Query: the `ApiResult` is
 * unwrapped only there (D5). The message is the kind, never anything of the request.
 */
export class ApiFailure extends Error {
  constructor(readonly apiError: ApiError) {
    super(apiError.kind);
    this.name = "ApiFailure";
  }
}

export function apiErrorOf(error: unknown): ApiError | null {
  return error instanceof ApiFailure ? error.apiError : null;
}
