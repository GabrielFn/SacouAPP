import { useLocalSearchParams } from "expo-router";

import { InviteScreen } from "../../../features/groups/ui/InviteScreen";

/** Screen 19d: the invite link and the QR of one group. */
export default function GroupInviteRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <InviteScreen groupId={groupId} />;
}
