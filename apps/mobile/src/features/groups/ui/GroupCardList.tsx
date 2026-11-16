import { View } from "react-native";

import type { MyGroup } from "../../../services/api/sacou-api";
import { useTheme } from "../../../theme/theme-context";
import { useRoundCards } from "../../rounds/hooks/use-round-cards";
import {
  groupCardActions,
  groupCardModel,
  type GroupCardAction,
} from "../model/groups-list.selectors";
import { PENDING_GROUP_SCREENS } from "../navigation";
import { GroupCard } from "./GroupCard";

export interface GroupCardListProps {
  readonly groups: readonly MyGroup[];
  readonly onAction: (action: GroupCardAction, groupId: string, roundId: string | null) => void;
  readonly onOpenRound: (groupId: string, roundId: string) => void;
}

/** The cards of screen 17, the soonest next round first and the groups without a round at the end. */
export function GroupCardList({ groups, onAction, onOpenRound }: GroupCardListProps) {
  const { tokens } = useTheme();
  const cards = useRoundCards(groups);
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {cards.groups.map(({ group, round }) => (
        <GroupCard
          key={group.groupId}
          model={groupCardModel(group)}
          round={round}
          actions={groupCardActions(group.role, PENDING_GROUP_SCREENS, round !== null)}
          onAction={(action, groupId) => {
            onAction(action, groupId, round?.roundId ?? null);
          }}
          onOpenRound={onOpenRound}
        />
      ))}
    </View>
  );
}
