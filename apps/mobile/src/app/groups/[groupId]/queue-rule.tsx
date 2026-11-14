import { useLocalSearchParams } from "expo-router";

import { QueueRuleScreen } from "../../../features/groups/ui/QueueRuleScreen";

/** Screen 18a: "Regra da fila" of one group. */
export default function QueueRuleRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  return <QueueRuleScreen groupId={groupId} />;
}
