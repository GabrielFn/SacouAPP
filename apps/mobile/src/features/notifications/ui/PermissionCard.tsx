import { Pressable, View } from "react-native";

import { notificationsStrings } from "../../../strings/notifications.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { BellIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { NotificationsView } from "../model/notifications-view";

const { permission } = notificationsStrings;

export interface PermissionCardProps {
  readonly card: NonNullable<NotificationsView["permissionCard"]>;
  readonly onActivate: () => void;
}

/**
 * The dark card of screen 28 (Notificacoes.dc.html, `#perm-title`): only while the pushes are off.
 * Refused for good, the text says so and the same button opens the settings of the phone.
 */
export function PermissionCard({ card, onActivate }: PermissionCardProps) {
  const { colors, tokens } = useTheme();
  const blocked = card === "open-settings";
  const asking = card === "asking";
  // "Ativar" in every state, as in the canvas: refused for good, it opens the settings (M10).
  const label = permission.enable;
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: tokens.spacing.m,
        padding: tokens.spacing.s14,
        borderRadius: tokens.radii.card,
        backgroundColor: colors.panelSurface,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: tokens.notifications.sizes.permissionIcon,
          aspectRatio: 1,
          borderRadius: tokens.notifications.sizes.permissionIcon,
          backgroundColor: colors.panelAccent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BellIcon color={colors.text} />
      </View>
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text accessibilityRole="header" variant="title" style={{ color: colors.onPanel }}>
          {permission.title}
        </Text>
        <Text variant="caption" style={{ color: colors.onPanel }}>
          {blocked ? permission.blockedBody : permission.body}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy: asking, disabled: asking }}
          disabled={asking}
          onPress={onActivate}
          style={{
            alignSelf: "flex-start",
            minHeight: tokens.sizes.minTouchTarget,
            marginTop: tokens.spacing.s6,
            paddingHorizontal: tokens.spacing.xl,
            borderRadius: tokens.radii.field,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.body700,
              fontSize: tokens.fontSizes.body,
              color: colors.onPrimary,
            }}
          >
            {label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
