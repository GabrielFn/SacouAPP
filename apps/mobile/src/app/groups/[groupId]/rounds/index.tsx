import { useLocalSearchParams } from "expo-router";

import { GroupRoundsScreen } from "../../../../features/rounds/ui/GroupRoundsScreen";

/** "Rodadas do grupo" (R97 part 2, D6): the upcoming and recent rounds of one group. */
export default function GroupRoundsRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <GroupRoundsScreen groupId={groupId} />;
}
