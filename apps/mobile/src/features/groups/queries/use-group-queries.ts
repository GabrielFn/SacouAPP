import { useQuery } from "@tanstack/react-query";

import { useServices } from "../../../services/services-context";
import { groupMembersQuery, groupQuery, myGroupsQuery } from "./group-queries";
import { groupSettingsQuery, groupTemplatesQuery } from "./group-settings-queries";

// The data stays only in the query cache (frontend.md, rule 1): these hooks return the query as it is.

export function useMyGroups() {
  const { sacouApi } = useServices();
  return useQuery(myGroupsQuery(sacouApi));
}

export function useGroup(groupId: string) {
  const { sacouApi } = useServices();
  return useQuery(groupQuery(sacouApi, groupId));
}

export function useGroupMembers(groupId: string) {
  const { sacouApi } = useServices();
  return useQuery(groupMembersQuery(sacouApi, groupId));
}

export function useGroupSettings(groupId: string) {
  const { sacouApi } = useServices();
  return useQuery(groupSettingsQuery(sacouApi, groupId));
}

/** Off for who cannot manage the settings: the API would answer 403 (D2). */
export function useGroupTemplates(groupId: string, enabled: boolean) {
  const { sacouApi } = useServices();
  return useQuery(groupTemplatesQuery(sacouApi, groupId, enabled));
}
