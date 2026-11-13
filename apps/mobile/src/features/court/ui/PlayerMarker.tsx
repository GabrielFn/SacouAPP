import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES, type TeamColorName } from "../../../theme/team-colors";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { HALF } from "../court.data";
import { markerColors } from "../model/marker-colors";
import { markerRadius, nameFontSize, type DrawnMarker } from "../model/team-markers";
import { BallIcon } from "./CourtIcons";

export interface PlayerMarkerProps {
  /** The marker with the center of its circle and the box of its name, in pixels from the corner of the square. */
  readonly drawn: DrawnMarker;
  readonly team: TeamColorName;
}

function roleOf(chip: DrawnMarker["chip"]): string | null {
  if (chip.isServer) return strings.court.zone.serverLabel;
  if (chip.isLibero) return strings.court.zone.liberoLabel;
  return chip.isSetter ? strings.court.zone.setterLabel : null;
}

/**
 * A player on the half court: a circle in the color of the team with the number of the position,
 * centered on the exact point of the formation, and the small name under it (or beside it, where
 * under it would cover something). One element for the screen reader: the whole name, the position
 * and the role.
 */
export function PlayerMarker({ drawn, team }: PlayerMarkerProps) {
  const { chip, placed } = drawn;
  const { colors, tokens } = useTheme();
  const { spacing, fontSizes, sizes } = tokens.court;
  const radius = markerRadius(tokens);
  const reach = radius + spacing.badgeOffsetX;
  const { fill, border, ink } = markerColors(chip, TEAM_PALETTES[team], colors);
  const box = placed.name.box;
  const left = Math.min(placed.x - reach, box.left);
  const top = Math.min(placed.y - reach, box.top);
  const right = Math.max(placed.x + reach, box.right);
  const bottom = Math.max(placed.y + reach, box.bottom);
  const badgeEdge = -spacing.badgeOffsetX;
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={strings.court.zone.markerLabel(chip.name, chip.zone, roleOf(chip))}
      style={{ position: "absolute", left, top, width: right - left, height: bottom - top }}
    >
      <View
        style={{
          position: "absolute",
          left: placed.x - radius - left,
          top: placed.y - radius - top,
          width: radius * HALF,
          height: radius * HALF,
          borderRadius: radius,
          borderWidth: tokens.borderWidths.thick,
          borderColor: border,
          backgroundColor: fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          tabular
          style={{ color: ink, fontFamily: fontFamilies.body700, fontSize: fontSizes.chipNumber }}
        >
          {chip.zone}
        </Text>
        {chip.isServer ? (
          <View style={{ position: "absolute", right: badgeEdge, bottom: badgeEdge }}>
            <BallIcon />
          </View>
        ) : null}
        {chip.isSetter ? (
          <View
            style={{
              position: "absolute",
              right: badgeEdge,
              top: badgeEdge,
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
            style={{
              position: "absolute",
              right: badgeEdge,
              top: badgeEdge,
              minWidth: sizes.badge,
              height: sizes.badge,
              paddingHorizontal: spacing.badgeOffsetX / HALF,
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
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          position: "absolute",
          left: box.left - left,
          top: box.top - top,
          width: box.right - box.left,
          textAlign: "center",
          color: colors.text,
          fontFamily: fontFamilies.body700,
          fontSize: nameFontSize(tokens),
        }}
      >
        {placed.name.text}
      </Text>
    </View>
  );
}
