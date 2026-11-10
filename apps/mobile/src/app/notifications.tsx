import { useRouter } from "expo-router";
import { View } from "react-native";

import { homeHref } from "../features/groups/navigation";
import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { EmptyState } from "../ui/EmptyState";
import { BackIcon } from "../ui/Icons";
import { IconButton } from "../ui/IconButton";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";

const { notifications } = strings.groups;

/** The notifications (screen 28). The list and the push permission come with E3.11. */
export default function NotificationsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  return (
    <Screen>
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
        <Text variant="display" displaySize="displayMedium">
          {notifications.title}
        </Text>
      </View>
      <EmptyState title={notifications.emptyTitle} body={notifications.emptyBody} />
    </Screen>
  );
}
