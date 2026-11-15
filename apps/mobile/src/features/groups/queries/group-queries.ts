import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

/** How long each answer is fresh (D6): the list changes with each group joined, a group less often. */
export const MY_GROUPS_STALE_MS = 30_000;
export const GROUP_STALE_MS = 60_000;

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

/** Off for who cannot manage invites: the API would answer 403. Never persisted (D5); no token in it. */
export function groupInvitesQuery(api: SacouApi, groupId: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.invites(groupId),
    queryFn: () => unwrap(api.listInvites(groupId)),
    staleTime: 0,
    enabled,
  });
}

/**
 * The admin's levels and the suggestions (ADR 0047): off for Placar and Jogador, so the route is never
 * called for them; outside the persisted allow list, so they live only in memory while the app runs.
 */
export function memberLevelsQuery(api: SacouApi, groupId: string, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.memberLevels(groupId),
    queryFn: () => unwrap(api.listMemberLevels(groupId)),
    staleTime: 0,
    enabled,
  });
}
