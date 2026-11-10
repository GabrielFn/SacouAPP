import { apiErrorOf, type ApiError } from "../../../services/api/api-error";
import type { MyGroup } from "../../../services/api/sacou-api";

/** What the groups query says, as plain data, so the selector needs no React. */
export interface GroupsQuerySnapshot {
  readonly status: "pending" | "error" | "success";
  readonly fetchStatus: "fetching" | "paused" | "idle";
  readonly data: readonly MyGroup[] | undefined;
  readonly error: unknown;
}

export type GroupsViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "offline-empty" }
  | { readonly kind: "error"; readonly error: ApiError }
  | { readonly kind: "empty" }
  | { readonly kind: "list"; readonly groups: readonly MyGroup[] };

const UNKNOWN_ERROR: ApiError = { kind: "unexpected", status: 0 };

/** One state from the query, so the screens never read `isLoading` beside `status` (frontend.md, rule 1). */
export function groupsViewState(query: GroupsQuerySnapshot): GroupsViewState {
  if (query.data !== undefined) {
    return query.data.length === 0 ? { kind: "empty" } : { kind: "list", groups: query.data };
  }
  if (query.status === "error") {
    return { kind: "error", error: apiErrorOf(query.error) ?? UNKNOWN_ERROR };
  }
  return query.fetchStatus === "paused" ? { kind: "offline-empty" } : { kind: "loading" };
}
