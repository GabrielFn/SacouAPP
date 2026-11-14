import { useLocalSearchParams } from "expo-router";

import { CreateRoundScreen } from "../../../../features/rounds/ui/CreateRoundScreen";

/** Screen 20: "Nova rodada" of one group. */
export default function CreateRoundRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <CreateRoundScreen groupId={groupId} />;
}
