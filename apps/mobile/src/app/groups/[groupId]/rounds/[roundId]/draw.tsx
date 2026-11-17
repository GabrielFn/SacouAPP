import { useLocalSearchParams } from "expo-router";

import { DrawScreen } from "../../../../../features/draw/ui/DrawScreen";

/** Screen 07. Only IDs in the route: the draw, with the levels, lives only in the screen (ADR 0060). */
export default function DrawRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  return <DrawScreen groupId={groupId} roundId={roundId} />;
}
