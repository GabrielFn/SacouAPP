import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { GroupRoundItem } from "../model/group-rounds";
import { RoundCardFrame } from "./RoundCardFrame";
import { RoundCardStatus } from "./RoundCardStatus";

export interface GroupRoundRowProps {
  readonly item: GroupRoundItem;
  readonly onOpen: (item: GroupRoundItem) => void;
}

/** A round of the list (Grupos.dc.html card, without the footer): day strip, date and state, venue, status. */
export function GroupRoundRow({ item, onOpen }: GroupRoundRowProps) {
  const { colors } = useTheme();
  const { card } = item;
  const canceled = item.state === "canceled";
  return (
    <RoundCardFrame
      groupId={card.groupId}
      strip={card.strip}
      accessibilityLabel={item.rowLabel}
      onPress={() => {
        onOpen(item);
      }}
    >
      <Text variant="bodyStrong" style={canceled ? { color: colors.textMuted } : undefined}>
        {item.rowTitle}
      </Text>
      <Text variant="muted" numberOfLines={1}>
        {card.venue}
      </Text>
      {canceled ? null : <RoundCardStatus round={card} />}
    </RoundCardFrame>
  );
}
