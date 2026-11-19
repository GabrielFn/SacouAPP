import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { RoleBadge } from "../../../ui/RoleBadge";
import { Text } from "../../../ui/Text";
import type { RoundCardModel } from "../../rounds/model/round-cards";
import { RoundCardStatus } from "../../rounds/ui/RoundCardStatus";
import type { GroupCardAction, GroupCardModel } from "../model/groups-list.selectors";
import { DayStrip } from "./DayStrip";

export interface GroupCardProps {
  readonly model: GroupCardModel;
  /** The next round of the group, or `null`: then the card is not touchable. */
  readonly round: RoundCardModel | null;
  readonly actions: readonly GroupCardAction[];
  readonly onAction: (action: GroupCardAction, groupId: string) => void;
  readonly onOpenRound: (groupId: string, roundId: string) => void;
}

function actionLabel(action: GroupCardAction): string {
  switch (action) {
    case "members":
      return strings.groups.card.members;
    case "settings":
      return strings.groups.card.settings;
    case "editRound":
      return strings.rounds.cards.editRound;
    case "createRound":
      return strings.rounds.cards.createRound;
  }
}

export interface CardMainProps {
  readonly model: GroupCardModel;
  readonly round: RoundCardModel | null;
}

function CardMain({ model, round }: CardMainProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", minHeight: tokens.sizes.groupCardMin }}>
      <DayStrip strip={round?.strip ?? null} groupId={model.groupId} />
      <View style={{ flex: 1, padding: tokens.spacing.m, gap: tokens.spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
          <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
            {model.name}
          </Text>
          <RoleBadge label={model.roleLabel} strong={model.role === "admin"} />
        </View>
        {round === null ? (
          <Text variant="bodyStrong">{model.nextRoundText}</Text>
        ) : (
          <>
            <Text variant="muted" numberOfLines={1}>
              {round.venue}
            </Text>
            <Text variant="bodyStrong">{round.nextText}</Text>
            <RoundCardStatus round={round} />
          </>
        )}
      </View>
    </View>
  );
}

/** A card of the groups list (17): touching it opens the next round; the footer links manage the group. */
export function GroupCard({ model, round, actions, onAction, onOpenRound }: GroupCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.card,
        overflow: "hidden",
      }}
    >
      {round === null ? (
        <CardMain model={model} round={round} />
      ) : (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={model.name}
          onPress={() => {
            onOpenRound(model.groupId, round.roundId);
          }}
        >
          <CardMain model={model} round={round} />
        </Pressable>
      )}
      {actions.length > 0 ? (
        <View
          accessibilityLabel={strings.groups.card.footerLabel(model.name)}
          style={{
            flexDirection: "row",
            borderTopWidth: tokens.borderWidths.thin,
            borderTopColor: colors.borderDivider,
          }}
        >
          {actions.map((action) => (
            <Pressable
              key={action}
              accessibilityRole="link"
              onPress={() => {
                onAction(action, model.groupId);
              }}
              style={{
                flex: 1,
                minHeight: tokens.sizes.cardFooter,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.link,
                  fontFamily: fontFamilies.body700,
                  fontSize: tokens.fontSizes.small,
                }}
              >
                {actionLabel(action)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
