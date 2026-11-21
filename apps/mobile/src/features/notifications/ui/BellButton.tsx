import { View } from "react-native";

import { notificationsStrings } from "../../../strings/notifications.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { IconButton } from "../../../ui/IconButton";
import { BellIcon } from "../../../ui/Icons";

export interface BellButtonProps {
  /** Derived from the `unreadCount` of the list (M7): never kept apart. */
  readonly unread: boolean;
  readonly onPress: () => void;
}

/** The bell of the home: the orange dot of an unread one sits over its corner (Notificacoes.dc.html .dot). */
export function BellButton({ unread, onPress }: BellButtonProps) {
  const { colors, tokens } = useTheme();
  return (
    <IconButton
      accessibilityLabel={unread ? notificationsStrings.bellUnread : notificationsStrings.bell}
      onPress={onPress}
    >
      <BellIcon />
      {unread ? (
        <View
          style={{
            position: "absolute",
            top: tokens.spacing.s10,
            right: tokens.spacing.s10,
            width: tokens.sizes.unreadDot,
            aspectRatio: 1,
            borderRadius: tokens.sizes.unreadDot,
            backgroundColor: colors.primary,
          }}
        />
      ) : null}
    </IconButton>
  );
}
