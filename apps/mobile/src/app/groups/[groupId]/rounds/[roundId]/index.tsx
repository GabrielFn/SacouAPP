import { useLocalSearchParams } from "expo-router";

import { AdminRoundScreen } from "../../../../../features/rounds/ui/AdminRoundScreen";

/** Screen 06 for who manages the rounds; one route for every role, the screen follows the role (D1). */
export default function RoundRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  return <AdminRoundScreen groupId={groupId} roundId={roundId} />;
}
