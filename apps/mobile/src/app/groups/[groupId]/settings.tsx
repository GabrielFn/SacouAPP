import { useLocalSearchParams } from "expo-router";

import { GroupSettingsScreen } from "../../../features/groups/ui/GroupSettingsScreen";

/** Screen 18: "Como jogamos" of one group. */
export default function GroupSettingsRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <GroupSettingsScreen groupId={groupId} />;
}
