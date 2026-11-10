import { apiErrorOf } from "../api/api-error";

/** A query (a GET) is tried again up to twice, only when the failure may pass by itself (D6). */
export const MAX_QUERY_RETRIES = 2;
const FIRST_SERVER_ERROR = 500;
const BASE_RETRY_DELAY_MS = 1_000;
const BACKOFF = 2;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const apiError = apiErrorOf(error);
  if (apiError === null || failureCount >= MAX_QUERY_RETRIES) return false;
  switch (apiError.kind) {
    case "offline":
    case "unavailable":
      return true;
    case "unexpected":
      return apiError.status >= FIRST_SERVER_ERROR;
    default:
      return false;
  }
}

/** The wait the API asked for on a 503; otherwise 1 s, then 2 s. */
export function queryRetryDelay(failureCount: number, error: unknown): number {
  const apiError = apiErrorOf(error);
  if (apiError?.kind === "unavailable") return apiError.retryAfterMs;
  return BASE_RETRY_DELAY_MS * BACKOFF ** failureCount;
}
