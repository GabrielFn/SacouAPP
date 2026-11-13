import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { chipColors } from "../model/chip-colors";
import type { DrawnChip } from "../model/team-chips";
import { BallIcon } from "./CourtIcons";

const HALF = 2;

export interface PlayerChipProps {
  /** The chip with its center and width already worked out, in pixels from the corner of the square. */
  readonly drawn: DrawnChip;
}

/**
 * A player on the half court. The chip has the width that was placed (never measured after drawing):
 * a name that does not fit ends in "…", and the number of the position and the badges never go.
 */
export function PlayerChip({ drawn }: PlayerChipProps) {
  const { chip } = drawn;
  const { colors, tokens } = useTheme();
  const { sizes, spacing, fontSizes } = tokens.court;
  const { fill, border, ink, subtleInk } = chipColors(chip, colors);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: drawn.x - drawn.width / HALF,
        top: drawn.y - sizes.chip / HALF,
        width: drawn.width,
      }}
    >
      <View
        accessibilityLabel={chip.name}
        style={{
          height: sizes.chip,
          paddingHorizontal: spacing.chipPadding,
          borderRadius: sizes.chip,
          borderWidth: tokens.borderWidths.thick,
          borderColor: border,
          backgroundColor: fill,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
        }}
      >
        {chip.isServer ? <BallIcon /> : null}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            flexShrink: 1,
            color: ink,
            fontFamily: fontFamilies.body700,
            fontSize: tokens.fontSizes.caption,
          }}
        >
          {chip.displayName}
        </Text>
        <Text
          tabular
          style={{
            color: subtleInk,
            fontFamily: fontFamilies.body600,
            fontSize: fontSizes.chipNumber,
          }}
        >
          {chip.zone}
        </Text>
        {chip.isSetter ? (
          <View
            accessibilityLabel={strings.court.zone.setterLabel}
            style={{
              position: "absolute",
              right: -spacing.badgeOffsetX,
              top: -spacing.badgeOffsetY,
              width: sizes.badge,
              height: sizes.badge,
              borderRadius: sizes.badge,
              backgroundColor: colors.text,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontFamily: fontFamilies.body700,
                fontSize: fontSizes.badge,
              }}
            >
              {strings.court.zone.setterBadge}
            </Text>
          </View>
        ) : null}
        {chip.isLibero ? (
          <View
            accessibilityLabel={strings.court.zone.liberoLabel}
            style={{
              position: "absolute",
              right: -spacing.badgeOffsetX,
              top: -spacing.badgeOffsetY,
              minWidth: sizes.badge,
              height: sizes.badge,
              paddingHorizontal: spacing.badgeOffsetX,
              borderRadius: sizes.badge,
              borderWidth: tokens.borderWidths.thick,
              borderColor: colors.text,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontFamily: fontFamilies.body700,
                fontSize: fontSizes.badge,
              }}
            >
              {strings.court.zone.liberoBadge}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
