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
  readonly onAction: (action: Exclude<GroupCardAction, "editRound">, groupId: string) => void;
  readonly onEditRound: (groupId: string, roundId: string) => void;
  readonly onOpenRound: (groupId: string, roundId: string) => void;
}

/** The cards of screen 17, the soonest next round first and the groups without a round at the end. */
export function GroupCardList({ groups, onAction, onEditRound, onOpenRound }: GroupCardListProps) {
  const { tokens } = useTheme();
  const cards = useRoundCards(groups);
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {cards.groups.map(({ group, round, hasNextRound }) => (
        <GroupCard
          key={group.groupId}
          model={groupCardModel(group)}
          round={round}
          actions={groupCardActions(group.role, PENDING_GROUP_SCREENS, hasNextRound)}
          onAction={(action, groupId) => {
            if (action !== "editRound") onAction(action, groupId);
            else if (round !== null) onEditRound(groupId, round.roundId);
          }}
          onOpenRound={onOpenRound}
        />
      ))}
    </View>
  );
}
