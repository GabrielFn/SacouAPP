import { Pressable, View } from "react-native";

import { notificationsStrings } from "../../../strings/notifications.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { CheckIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { NotificationRowView } from "../model/group-by-day";

export interface NotificationRowProps {
  readonly row: NotificationRowView;
  readonly first: boolean;
  readonly onOpen: (notificationId: string, groupId: string, roundId: string) => void;
}

/** A dot for an unread one, with its name for the screen reader (Notificacoes.dc.html .dot). */
function UnreadDot() {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityLabel={notificationsStrings.unread}
      style={{
        width: tokens.sizes.unreadDot,
        aspectRatio: 1,
        borderRadius: tokens.sizes.unreadDot,
        backgroundColor: colors.primary,
      }}
    />
  );
}

/**
 * One line of screen 28 (Notificacoes.dc.html .it): the icon of the kind, the title and the subtitle the
 * server rendered, the time and the dot. The whole line opens the round and marks it read.
 */
export function NotificationRow({ row, first, onOpen }: NotificationRowProps) {
  const { colors, tokens } = useTheme();
  const { item } = row;
  const label = [
    item.title,
    item.subtitle,
    row.time,
    item.read ? null : notificationsStrings.unread,
  ]
    .filter((part) => part !== null)
    .join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        onOpen(item.id, item.groupId, item.roundId);
      }}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: tokens.spacing.m,
        padding: tokens.spacing.m,
        minHeight: tokens.sizes.notificationRowMin,
        borderTopWidth: first ? 0 : tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
      }}
    >
      <View
        style={{
          width: tokens.sizes.notificationIcon,
          aspectRatio: 1,
          borderRadius: tokens.sizes.notificationIcon,
          backgroundColor: colors.goingFill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckIcon color={colors.goingText} />
      </View>
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="bodyStrong">{item.title}</Text>
        <Text variant="caption" style={{ color: colors.textMuted }}>
          {item.subtitle}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s6 }}>
        {item.read ? null : <UnreadDot />}
        <Text variant="caption" tabular style={{ color: colors.textMuted }}>
          {row.time}
        </Text>
      </View>
    </Pressable>
  );
}
