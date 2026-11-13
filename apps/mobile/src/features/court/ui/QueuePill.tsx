import { View, type DimensionValue } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { fontFamilies, palette } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";

export interface QueuePillProps {
  readonly position: number;
  readonly label: string;
  /** The widest the pill gets; a longer name ends in "…". */
  readonly maxWidth?: DimensionValue;
}

/** A white pill with its place in the line, the same in the sun and night themes. */
export function QueuePill({ position, label, maxWidth = "100%" }: QueuePillProps) {
  const { tokens } = useTheme();
  const { sizes, fontSizes } = tokens.court;
  return (
    <View
      style={{
        height: sizes.pill,
        maxWidth,
        borderRadius: sizes.pill,
        borderWidth: tokens.borderWidths.thick,
        borderColor: palette.black,
        backgroundColor: palette.white,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s6,
        paddingLeft: tokens.spacing.xs,
        paddingRight: tokens.spacing.m,
      }}
    >
      <View
        style={{
          width: sizes.pillBadge,
          height: sizes.pillBadge,
          borderRadius: sizes.pillBadge,
          backgroundColor: palette.black,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: palette.white,
            fontFamily: fontFamilies.display800,
            fontSize: tokens.fontSizes.caption,
          }}
        >
          {position}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flexShrink: 1,
          color: palette.black,
          fontFamily: fontFamilies.display800,
          fontSize: fontSizes.pill,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
