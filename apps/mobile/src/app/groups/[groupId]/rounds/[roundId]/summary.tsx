import { useLocalSearchParams } from "expo-router";

import { RoundSummaryScreen } from "../../../../../features/summary/ui/RoundSummaryScreen";

/** Screen 12. Only IDs in the route: the numbers come from the server cache. */
export default function RoundSummaryRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  return <RoundSummaryScreen groupId={groupId} roundId={roundId} />;
}
