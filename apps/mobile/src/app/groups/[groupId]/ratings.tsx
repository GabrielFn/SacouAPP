import { useLocalSearchParams } from "expo-router";

import { RatingReviewScreen } from "../../../features/groups/ui/RatingReviewScreen";

/** Screen 19b: the levels to confirm in one group (admins and co-admins). */
export default function GroupRatingsRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <RatingReviewScreen groupId={groupId} />;
}
