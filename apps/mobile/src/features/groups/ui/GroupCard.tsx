import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { RoleBadge } from "../../../ui/RoleBadge";
import { Text } from "../../../ui/Text";
import type { GroupCardAction, GroupCardModel } from "../model/groups-list.selectors";
import { DayStrip } from "./DayStrip";

export interface GroupCardProps {
  readonly model: GroupCardModel;
  readonly actions: readonly GroupCardAction[];
  readonly onAction: (action: GroupCardAction, groupId: string) => void;
}

function actionLabel(action: GroupCardAction): string {
  switch (action) {
    case "members":
      return strings.groups.card.members;
    case "settings":
      return strings.groups.card.settings;
  }
}

/** The card is not touchable until the round screens exist (E4.6); only the footer links are. */
export function GroupCard({ model, actions, onAction }: GroupCardProps) {
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
      <View style={{ flexDirection: "row", minHeight: tokens.sizes.groupCardMin }}>
        <DayStrip />
        <View
          style={{
            flex: 1,
            minWidth: 0,
            padding: tokens.spacing.m,
            gap: tokens.spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {model.name}
            </Text>
            <RoleBadge label={model.roleLabel} strong={model.role === "admin"} />
          </View>
          <Text variant="bodyStrong">{model.nextRoundText}</Text>
        </View>
      </View>
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
