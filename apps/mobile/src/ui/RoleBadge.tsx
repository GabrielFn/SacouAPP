import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { Text } from "./Text";

export interface RoleBadgeProps {
  readonly label: string;
  /** The admin badge is dark; the others are the neutral one. */
  readonly strong: boolean;
}

/** Not interactive: exempt from the touch target floor. */
export function RoleBadge({ label, strong }: RoleBadgeProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        minHeight: tokens.sizes.roleBadge,
        borderRadius: tokens.radii.roleBadge,
        paddingHorizontal: tokens.spacing.s10,
        backgroundColor: strong ? colors.text : colors.badgeSurface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: strong ? colors.background : colors.textMuted,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.caption,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
