import { useQuery } from "@tanstack/react-query";

import { useServices } from "../../../services/services-context";
import { groupMembersQuery, groupQuery, myGroupsQuery } from "./group-queries";

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
