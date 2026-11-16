import { Stack, useLocalSearchParams } from "expo-router";

import { AddPlayerScreen } from "../../../../../features/rounds/ui/AddPlayerScreen";

/** Screen 21, as a modal over the round (D1). Only IDs in the route: never a name. */
export default function AddPlayerRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  return (
    <>
      <Stack.Screen options={{ presentation: "modal" }} />
      <AddPlayerScreen groupId={groupId} roundId={roundId} />
    </>
  );
}
