import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import { TakeOverScreen } from "../../../../../features/court/ui/TakeOverScreen";

/** Screen 09a. Only IDs in the route: the summary lives in the query cache, the flow in the screen. */
export default function TakeOverRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  const origin = useMemo(() => ({ groupId, roundId }), [groupId, roundId]);
  return <TakeOverScreen origin={origin} />;
}
