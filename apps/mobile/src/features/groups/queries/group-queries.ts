import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

const SECOND_MS = 1_000;
/** How long each answer is fresh (D6): the list changes with each group joined, a group less often. */
export const MY_GROUPS_STALE_MS = 30 * SECOND_MS;
export const GROUP_STALE_MS = 60 * SECOND_MS;

/** The queries of the groups slice, as options: the hooks use them, and the tests run them without React. */
export function myGroupsQuery(api: SacouApi) {
  return queryOptions({
    queryKey: queryKeys.groups(),
    queryFn: () => unwrap(api.listMyGroups()),
    staleTime: MY_GROUPS_STALE_MS,
  });
}

export function groupQuery(api: SacouApi, groupId: string) {
  return queryOptions({
    queryKey: queryKeys.group(groupId),
    queryFn: () => unwrap(api.getGroup(groupId)),
    staleTime: GROUP_STALE_MS,
  });
}

export function groupMembersQuery(api: SacouApi, groupId: string) {
  return queryOptions({
    queryKey: queryKeys.members(groupId),
    queryFn: () => unwrap(api.listMembers(groupId)),
    staleTime: GROUP_STALE_MS,
  });
}
