import type { MyGroup } from "../../../services/api/sacou-api";
import {
  queryViewState,
  type QuerySnapshot,
  type QueryWaitState,
} from "../../../services/query/query-view-state";

/** What the groups query says, as plain data, so the selector needs no React. */
export type GroupsQuerySnapshot = QuerySnapshot<readonly MyGroup[]>;

export type GroupsViewState =
  | QueryWaitState
  | { readonly kind: "empty" }
  | { readonly kind: "list"; readonly groups: readonly MyGroup[] };

/** One state from the query, so the screens never read `isLoading` beside `status` (frontend.md, rule 1). */
export function groupsViewState(query: GroupsQuerySnapshot): GroupsViewState {
  return queryViewState(query, (groups): GroupsViewState =>
    groups.length === 0 ? { kind: "empty" } : { kind: "list", groups },
  );
}
