import { apiErrorOf, type ApiError } from "../api/api-error";

/** What a query says, as plain data, so a selector needs no React. */
export interface QuerySnapshot<T> {
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly data: T | undefined;
  readonly error: unknown;
}

/** The states every screen of one query has before its data, besides what its data shows. */
export type QueryWaitState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline-empty" }
  | { readonly kind: "error"; readonly error: ApiError };

const UNKNOWN_ERROR: ApiError = { kind: "unexpected", status: 0 };

/**
 * One state from the query, so the screens never read `isLoading` beside `status` (frontend.md, rule 1):
 * the data when there is some (kept data wins over a failed refetch), else the error, else waiting.
 */
export function queryViewState<T, V>(
  query: QuerySnapshot<T>,
  fromData: (data: T) => V,
): QueryWaitState | V {
  if (query.data !== undefined) return fromData(query.data);
  if (query.status === "error") {
    return { kind: "error", error: apiErrorOf(query.error) ?? UNKNOWN_ERROR };
  }
  return query.fetchStatus === "paused" ? { kind: "offline-empty" } : { kind: "loading" };
}
