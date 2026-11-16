import { useLocalSearchParams } from "expo-router";

import {
  CreateRoundScreen,
  EditRoundScreen,
} from "../../../../features/rounds/ui/CreateRoundScreen";

/** Screen 20: "Nova rodada" of one group, or "Editar rodada" with `?roundId=` (only IDs in the route). */
export default function CreateRoundRoute() {
  const { groupId, roundId } = useLocalSearchParams<{ groupId: string; roundId?: string }>();
  return roundId === undefined ? (
    <CreateRoundScreen groupId={groupId} />
  ) : (
    <EditRoundScreen groupId={groupId} roundId={roundId} />
  );
}
