import { Pressable, useWindowDimensions, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import {
  NOTIFICATIONS_HEADER_WRAP_FONT_SCALE,
  NOTIFICATIONS_TITLE_MIN_FONT_SCALE,
} from "../../../theme/notification-tokens.data";
import { fontFamilies } from "../../../theme/tokens.data";
import { BackIcon } from "../../../ui/Icons";
import { IconButton } from "../../../ui/IconButton";
import { Text } from "../../../ui/Text";

const { notifications } = strings;

export interface NotificationsHeaderProps {
  readonly canMarkAll: boolean;
  readonly onBack: () => void;
  readonly onMarkAll: () => void;
}

/** With a large font "Marcar como lidas" goes under the title, to the right. */
export function notificationsHeaderWraps(fontScale: number): boolean {
  return fontScale >= NOTIFICATIONS_HEADER_WRAP_FONT_SCALE;
}

/**
 * The header of screen 28 (R98, item 8): "Notificações" stays on one line and shrinks to fit beside
 * "Marcar como lidas", which never shrinks; without it, Android broke the word ("Notificaçõe/s").
 */
export function NotificationsHeader({ canMarkAll, onBack, onMarkAll }: NotificationsHeaderProps) {
  const { colors, tokens } = useTheme();
  const wraps = notificationsHeaderWraps(useWindowDimensions().fontScale);
  const markAll = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={notifications.markAllRead}
      accessibilityState={{ disabled: !canMarkAll }}
      disabled={!canMarkAll}
      onPress={onMarkAll}
      style={{
        flexShrink: 0,
        alignSelf: wraps ? "flex-end" : "center",
        minHeight: tokens.notifications.sizes.headerButton,
        paddingHorizontal: tokens.spacing.s,
        justifyContent: "center",
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fontFamilies.body600,
          fontSize: tokens.fontSizes.small,
          color: canMarkAll ? colors.text : colors.textMuted,
          textDecorationLine: "underline",
        }}
      >
        {notifications.markAllRead}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: wraps ? "column" : "row", gap: tokens.spacing.s }}>
      <View
        style={{
          flex: wraps ? undefined : 1,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.s,
        }}
      >
        <IconButton accessibilityLabel={strings.a11y.back} onPress={onBack}>
          <BackIcon />
        </IconButton>
        <Text
          variant="display"
          displaySize="displayMedium"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={NOTIFICATIONS_TITLE_MIN_FONT_SCALE}
          style={{ flex: 1 }}
        >
          {notifications.title}
        </Text>
      </View>
      {markAll}
    </View>
  );
}
