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
  readonly onOpenGroup: (groupId: string) => void;
}

/**
 * The cards of screen 17, the soonest next round first and the groups without a round at the end. A
 * round being played takes the place of the next one on the card, and touching the card opens the list
 * of the rounds of the group (R97 part 2, D3); "Editar rodada" still edits the next one.
 */
export function GroupCardList({ groups, onAction, onEditRound, onOpenGroup }: GroupCardListProps) {
  const { tokens } = useTheme();
  const cards = useRoundCards(groups);
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {cards.groups.map(({ group, round, live, hasNextRound }) => (
        <GroupCard
          key={group.groupId}
          model={groupCardModel(group)}
          round={live ?? round}
          actions={groupCardActions(group.role, PENDING_GROUP_SCREENS, hasNextRound)}
          onAction={(action, groupId) => {
            if (action !== "editRound") onAction(action, groupId);
            else if (round !== null) onEditRound(groupId, round.roundId);
          }}
          onOpenGroup={onOpenGroup}
        />
      ))}
    </View>
  );
}
