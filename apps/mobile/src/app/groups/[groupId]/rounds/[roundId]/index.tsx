import { useLocalSearchParams } from "expo-router";

import { RoundScreen } from "../../../../../features/rounds/ui/RoundScreen";

/** Screens 06 and 26: one route for every role, the screen follows the role (D1). */
export default function RoundRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  return <RoundScreen groupId={groupId} roundId={roundId} />;
}
