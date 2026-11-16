import { useRoundScreen } from "../hooks/use-round-screen";
import { managesRounds, roundSettingsOf } from "../model/round-detail";
import { AdminRoundScreen } from "./AdminRoundScreen";
import { PlayerRoundScreen } from "./PlayerRoundScreen";
import { RoundLoading } from "./RoundHeading";

export interface RoundScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * One route for screens 06 and 26: the role in the group query picks the screen, so a role changed on
 * another phone swaps it on the next refetch (D1).
 */
export function RoundScreen({ groupId, roundId }: RoundScreenProps) {
  const model = useRoundScreen(groupId, roundId);
  const { group, round, members } = model;
  if (group.data === undefined || round.data === undefined) {
    return <RoundLoading queries={[group, round]} />;
  }
  const settings = roundSettingsOf(round.data);
  const memberList = members.data ?? [];
  return managesRounds(group.data.role) ? (
    <AdminRoundScreen
      groupId={groupId}
      group={group.data}
      round={round.data}
      settings={settings}
      members={memberList}
      model={model}
    />
  ) : (
    <PlayerRoundScreen
      group={group.data}
      round={round.data}
      settings={settings}
      members={memberList}
      model={model}
    />
  );
}
