import { useLocalSearchParams } from "expo-router";

import { MvpVoteScreen } from "../../../../../features/summary/mvp-vote/ui/MvpVoteScreen";

/** Screen 12a. Only IDs in the route: the ballot and the vote come from the server cache. */
export default function MvpVoteRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId: string }>();
  return <MvpVoteScreen groupId={groupId} roundId={roundId} />;
}
