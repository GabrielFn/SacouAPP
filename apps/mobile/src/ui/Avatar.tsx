import { View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { PersonIcon } from "./Icons";
import { Text } from "./Text";

export interface AvatarProps {
  /** "JO"; `null` draws the person icon (no nickname yet). */
  readonly initials: string | null;
  /** A guest without an account: white with a dashed border (Membros.dc.html). */
  readonly dashed: boolean;
  /** Your own row: night with sand letters. */
  readonly own?: boolean;
}

/** The round avatar of a member (`.av`): hidden from the screen reader, the name is beside it. */
export function Avatar({ initials, dashed, own = false }: AvatarProps) {
  const { colors, tokens } = useTheme();
  const ground = dashed ? colors.surface : own ? colors.text : colors.avatarSurface;
  const ink = own && !dashed ? colors.background : colors.text;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tokens.sizes.avatar,
        aspectRatio: 1,
        borderRadius: tokens.radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ground,
        borderWidth: dashed ? tokens.borderWidths.thin : undefined,
        borderStyle: dashed ? "dashed" : undefined,
        borderColor: dashed ? colors.borderDashed : undefined,
      }}
    >
      {initials === null ? (
        <PersonIcon color={colors.textMuted} />
      ) : (
        <Text
          numberOfLines={1}
          style={{
            color: ink,
            fontFamily: fontFamilies.display800,
            fontSize: tokens.fontSizes.displayBlock,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
