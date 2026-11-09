import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies, palette } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { anchorAt, type ScreenPlace } from "../model/court-geometry";
import type { PlayerChipModel } from "../model/court-screen.types";
import { BallIcon } from "./CourtIcons";

export interface PlayerChipProps {
  readonly chip: PlayerChipModel;
  readonly place: ScreenPlace;
}

/** A player on the half court. The holder is as wide as the court twice over so the name never wraps. */
export function PlayerChip({ chip, place }: PlayerChipProps) {
  const { colors, tokens } = useTheme();
  const { sizes, spacing, fontSizes } = tokens.court;
  const anchor = anchorAt(place);
  const ink = chip.isServer ? palette.black : colors.text;
  const subtleInk = chip.isServer ? palette.black : colors.textMuted;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: anchor.left,
        top: anchor.top,
        width: anchor.width,
        alignItems: "center",
        transform: [{ translateY: "-50%" }],
      }}
    >
      <View
        style={{
          height: sizes.chip,
          paddingHorizontal: spacing.chipPadding,
          borderRadius: sizes.chip,
          borderWidth: tokens.borderWidths.thick,
          borderColor: chip.isServer ? colors.serverOutline : colors.text,
          backgroundColor: chip.isServer ? colors.accent : colors.background,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.xs,
        }}
      >
        {chip.isServer ? <BallIcon /> : null}
        <Text
          numberOfLines={1}
          style={{
            color: ink,
            fontFamily: fontFamilies.body700,
            fontSize: tokens.fontSizes.caption,
          }}
        >
          {chip.name}
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
      </View>
    </View>
  );
}
