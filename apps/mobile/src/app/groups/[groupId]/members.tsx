import { useLocalSearchParams } from "expo-router";

import { MembersScreen } from "../../../features/groups/ui/MembersScreen";

/** Screen 19: the members of one group. */
export default function GroupMembersRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <MembersScreen groupId={groupId} />;
}
