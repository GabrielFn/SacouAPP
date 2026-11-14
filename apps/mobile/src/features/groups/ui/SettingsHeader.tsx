import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackIcon } from "../../../ui/Icons";
import { IconButton } from "../../../ui/IconButton";
import { Text } from "../../../ui/Text";
import { groupsHref } from "../navigation";

/** Back and the title of screen 18. */
export function SettingsHeader() {
  const router = useRouter();
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <IconButton
        accessibilityLabel={strings.a11y.back}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(groupsHref);
        }}
      >
        <BackIcon />
      </IconButton>
      <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
        {strings.settings.screen.title}
      </Text>
    </View>
  );
}
