import { View } from "react-native";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { Text } from "./Text";

/** The yellow "Pro" tag. Not interactive; the dark text on yellow is above AA. */
export function ProBadge() {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        minHeight: tokens.sizes.proBadge,
        paddingHorizontal: tokens.spacing.s,
        borderRadius: tokens.radii.roleBadge,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.caption,
        }}
      >
        {strings.settings.screen.pro}
      </Text>
    </View>
  );
}
