import { Pressable, View } from "react-native";

import type { MyGroup } from "../../../services/api/sacou-api";
import { useTheme } from "../../../theme/theme-context";
import { strings } from "../../../strings/pt-BR";
import type { ScreenAction } from "../../../ui/ActionButtons";
import { EmptyState } from "../../../ui/EmptyState";
import { Text } from "../../../ui/Text";
import { DayStrip } from "../../groups/ui/DayStrip";
import { useRoundCards } from "../hooks/use-round-cards";
import type { RoundCardModel } from "../model/round-cards";
import { RoundCardStatus } from "./RoundCardStatus";

const { home } = strings.groups;

export interface HomeRoundCardsProps {
  readonly groups: readonly MyGroup[];
  readonly emptyActions: readonly ScreenAction[];
  readonly onOpenRound: (groupId: string, roundId: string) => void;
}

interface HomeRoundCardProps {
  readonly groupName: string;
  readonly round: RoundCardModel;
  readonly onOpenRound: (groupId: string, roundId: string) => void;
}

function HomeRoundCard({ groupName, round, onOpenRound }: HomeRoundCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={groupName}
      onPress={() => {
        onOpenRound(round.groupId, round.roundId);
      }}
      style={{
        flexDirection: "row",
        minHeight: tokens.sizes.groupCardMin,
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.card,
        overflow: "hidden",
      }}
    >
      <DayStrip strip={round.strip} groupId={round.groupId} />
      <View style={{ flex: 1, padding: tokens.spacing.m, gap: tokens.spacing.xs }}>
        <Text variant="title" numberOfLines={1}>
          {groupName}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {round.venue}
        </Text>
        <RoundCardStatus round={round} />
      </View>
    </Pressable>
  );
}

/** The home (03): "N rodadas essa semana." and the next round of each group, the soonest first. */
export function HomeRoundCards({ groups, emptyActions, onOpenRound }: HomeRoundCardsProps) {
  const { tokens } = useTheme();
  const cards = useRoundCards(groups);
  const withRound = cards.groups.flatMap(({ group, round }) =>
    round === null ? [] : [{ name: group.name, round }],
  );
  if (withRound.length === 0) {
    return (
      <EmptyState title={home.noRoundsTitle} body={home.noRoundsBody} actions={emptyActions} />
    );
  }
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {cards.weekText === null ? null : <Text variant="muted">{cards.weekText}</Text>}
      {withRound.map(({ name, round }) => (
        <HomeRoundCard
          key={round.groupId}
          groupName={name}
          round={round}
          onOpenRound={onOpenRound}
        />
      ))}
    </View>
  );
}
