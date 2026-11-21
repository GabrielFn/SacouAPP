import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { homeHref } from "../features/groups/navigation";
import { useNotificationsScreen } from "../features/notifications/hooks/use-notifications-screen";
import { NotificationsBodyView } from "../features/notifications/ui/NotificationsBodyView";
import { PermissionCard } from "../features/notifications/ui/PermissionCard";
import { roundHref } from "../features/rounds/navigation";
import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { BackIcon } from "../ui/Icons";
import { IconButton } from "../ui/IconButton";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

const { notifications } = strings;

/** The notifications (screen 28): the permission card, the list by day and "Marcar como lidas" (E3.11). */
export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const { view, activate, markAllRead, markRead, retry } = useNotificationsScreen();
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <IconButton
          accessibilityLabel={strings.a11y.back}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace(homeHref);
          }}
        >
          <BackIcon />
        </IconButton>
        <Text variant="display" displaySize="displayMedium" style={{ flex: 1 }}>
          {notifications.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notifications.markAllRead}
          accessibilityState={{ disabled: !view.canMarkAll }}
          disabled={!view.canMarkAll}
          onPress={markAllRead}
          style={{
            minHeight: tokens.sizes.headerTextButton,
            paddingHorizontal: tokens.spacing.s,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.body600,
              fontSize: tokens.fontSizes.small,
              color: view.canMarkAll ? colors.text : colors.textMuted,
              textDecorationLine: "underline",
            }}
          >
            {notifications.markAllRead}
          </Text>
        </Pressable>
      </View>
      {view.permissionCard !== null ? (
        <PermissionCard card={view.permissionCard} onActivate={activate} />
      ) : null}
      <NotificationsBodyView
        body={view.body}
        onRetry={retry}
        onOpen={(notificationId, groupId, roundId) => {
          markRead(notificationId);
          router.push(roundHref(groupId, roundId));
        }}
      />
    </Screen>
  );
}
