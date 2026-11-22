import type { ReactNode } from "react";
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
  readonly onOpenSummary: (groupId: string, roundId: string) => void;
}

export interface HomeRoundCardProps {
  readonly groupName: string;
  readonly round: RoundCardModel;
  /** The foot of the card: the status of the next round, or "Ver resumo" for a round that took place. */
  readonly footer: ReactNode;
  readonly onOpen: (groupId: string, roundId: string) => void;
}

function HomeRoundCard({ groupName, round, footer, onOpen }: HomeRoundCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={groupName}
      onPress={() => {
        onOpen(round.groupId, round.roundId);
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
        {footer}
      </View>
    </Pressable>
  );
}

export interface RecentRoundFooterProps {
  readonly round: RoundCardModel;
}

/** "Rodada de ter, 3/11" and the text "Ver resumo" (question 153). */
function RecentRoundFooter({ round }: RecentRoundFooterProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ marginTop: "auto", gap: tokens.spacing.xs, paddingTop: tokens.spacing.xs }}>
      <Text variant="muted">{round.recentText}</Text>
      <Text variant="bodyStrong">{strings.rounds.cards.seeSummary}</Text>
    </View>
  );
}

export interface LiveRoundFooterProps {
  readonly round: RoundCardModel;
}

/** "Rolando agora" over the status of the round being played (R97, D3). */
function LiveRoundFooter({ round }: LiveRoundFooterProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ marginTop: "auto", gap: tokens.spacing.xs, paddingTop: tokens.spacing.xs }}>
      <Text variant="bodyStrong">{round.nextText}</Text>
      <RoundCardStatus round={round} />
    </View>
  );
}

/**
 * The home (03): "N rodadas essa semana.", the rounds being played (they open screen 06, R97 D3), the
 * ones that took place ("Ver resumo") and the next round of each group, the soonest first.
 */
export function HomeRoundCards({
  groups,
  emptyActions,
  onOpenRound,
  onOpenSummary,
}: HomeRoundCardsProps) {
  const { tokens } = useTheme();
  const cards = useRoundCards(groups);
  const withRound = cards.groups
    .flatMap(({ group, upcoming }, index) =>
      upcoming.map((round) => ({ name: group.name, round, index })),
    )
    .sort((first, second) => first.round.startsAt - second.round.startsAt || first.index - second.index);
  const withSummary = cards.groups.flatMap(({ group, recent }) =>
    recent === null ? [] : [{ name: group.name, recent }],
  );
  const withLive = cards.groups.flatMap(({ group, live }) =>
    live === null ? [] : [{ name: group.name, live }],
  );
  if (withRound.length === 0 && withSummary.length === 0 && withLive.length === 0) {
    return (
      <EmptyState title={home.noRoundsTitle} body={home.noRoundsBody} actions={emptyActions} />
    );
  }
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      {cards.weekText === null ? null : <Text variant="muted">{cards.weekText}</Text>}
      {withLive.map(({ name, live }) => (
        <HomeRoundCard
          key={`live-${live.roundId}`}
          groupName={name}
          round={live}
          footer={<LiveRoundFooter round={live} />}
          onOpen={onOpenRound}
        />
      ))}
      {withSummary.map(({ name, recent }) => (
        <HomeRoundCard
          key={`summary-${recent.roundId}`}
          groupName={name}
          round={recent}
          footer={<RecentRoundFooter round={recent} />}
          onOpen={onOpenSummary}
        />
      ))}
      {withRound.map(({ name, round }) => (
        <HomeRoundCard
          key={`next-${round.roundId}`}
          groupName={name}
          round={round}
          footer={<RoundCardStatus round={round} />}
          onOpen={onOpenRound}
        />
      ))}
    </View>
  );
}
