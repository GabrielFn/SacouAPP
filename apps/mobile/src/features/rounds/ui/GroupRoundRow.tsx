import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import { DayStrip } from "../../groups/ui/DayStrip";
import type { GroupRoundItem } from "../model/group-rounds";
import { RoundCardStatus } from "./RoundCardStatus";

export interface GroupRoundRowProps {
  readonly item: GroupRoundItem;
  readonly onOpen: (item: GroupRoundItem) => void;
}

/** A round of the list (Grupos.dc.html card, without the footer): day strip, date and state, venue, status. */
export function GroupRoundRow({ item, onOpen }: GroupRoundRowProps) {
  const { colors, tokens } = useTheme();
  const { card } = item;
  const canceled = item.state === "canceled";
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.rowLabel}
      onPress={() => {
        onOpen(item);
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
      <DayStrip strip={card.strip} groupId={card.groupId} />
      <View style={{ flex: 1, padding: tokens.spacing.m, gap: tokens.spacing.xs }}>
        <Text variant="bodyStrong" style={canceled ? { color: colors.textMuted } : undefined}>
          {item.rowTitle}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {card.venue}
        </Text>
        {canceled ? null : <RoundCardStatus round={card} />}
      </View>
    </Pressable>
  );
}
