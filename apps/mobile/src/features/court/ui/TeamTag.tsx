import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES, type TeamColorName } from "../../../theme/team-colors";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

export interface TeamTagProps {
  readonly color: TeamColorName;
  readonly letter: string;
  readonly label: string;
}

/** The letter of each side on the badge ("A Laranja", "B Azul"). */
export const SIDE_LETTERS: Readonly<Record<"a" | "b", string>> = { a: "A", b: "B" };

/** The name of the team in its color, with the letter of its side in a round badge. */
export function TeamTag({ color, letter, label }: TeamTagProps) {
  const { tokens } = useTheme();
  const { sizes, fontSizes } = tokens.court;
  const palette = TEAM_PALETTES[color];
  return (
    <View
      style={{
        height: sizes.tag,
        borderRadius: sizes.tag,
        backgroundColor: palette.fill,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s6,
        paddingLeft: tokens.spacing.xs,
        paddingRight: tokens.spacing.m,
      }}
    >
      <View
        style={{
          width: sizes.tagBadge,
          height: sizes.tagBadge,
          borderRadius: sizes.tagBadge,
          backgroundColor: palette.badgeFill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: palette.onBadge,
            fontFamily: fontFamilies.display800,
            fontSize: fontSizes.tagBadge,
          }}
        >
          {letter}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: palette.onFill,
          fontFamily: fontFamilies.display800,
          fontSize: fontSizes.tag,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
