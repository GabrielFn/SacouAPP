import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES } from "../../../theme/team-colors";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type { TimelineRowModel } from "../corrections/corrections-selectors";

export interface TimelineRowProps {
  readonly row: TimelineRowModel;
  readonly onPress: (eventId: string) => void;
}

/** One point of screen 24: the score after it, the team, who served and the side-out. */
export function TimelineRow({ row, onPress }: TimelineRowProps) {
  const { colors, tokens } = useTheme();
  const { sizes } = tokens.court;
  const palette = TEAM_PALETTES[row.color];
  // Lines that will be erased are muted by colour, never by opacity, which would break contrast AA.
  const mutedColor = row.willUndo ? { color: colors.textMuted } : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityState={{ selected: row.selected }}
      onPress={() => {
        onPress(row.eventId);
      }}
      style={{
        minHeight: tokens.sizes.minTouchTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingHorizontal: tokens.spacing.s10,
        borderRadius: tokens.radii.field,
        backgroundColor: row.selected ? colors.surface : "transparent",
        borderWidth: row.selected ? tokens.court.borderWidths.outline : undefined,
        borderColor: colors.text,
      }}
    >
      <Text
        tabular
        style={{
          flexBasis: "22%",
          flexShrink: 0,
          fontFamily: fontFamilies.display800,
          fontSize: tokens.fontSizes.displayBrand,
          textDecorationLine: row.willUndo ? "line-through" : "none",
          ...mutedColor,
        }}
      >
        {row.scoreText}
      </Text>
      <View
        style={{
          width: sizes.badge + tokens.spacing.xs,
          height: sizes.badge + tokens.spacing.xs,
          borderRadius: tokens.radii.roleBadge,
          backgroundColor: palette.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: palette.onFill,
            fontFamily: fontFamilies.display800,
            fontSize: tokens.fontSizes.caption,
          }}
        >
          {strings.court.zone.teamLetter[row.team]}
        </Text>
      </View>
      <Text variant="muted" numberOfLines={1} style={{ flexShrink: 1, ...mutedColor }}>
        {row.serveText}
        {row.serveName === null ? null : (
          <Text variant="bodyStrong" style={{ fontSize: tokens.fontSizes.small, ...mutedColor }}>
            {` ${row.serveName}`}
          </Text>
        )}
      </Text>
      {row.sideOutText === null ? null : (
        <View
          style={{
            marginLeft: "auto",
            paddingHorizontal: tokens.spacing.s,
            minHeight: sizes.badge + tokens.spacing.s,
            borderRadius: tokens.radii.pill,
            borderWidth: tokens.borderWidths.thin,
            borderColor: palette.fill,
            backgroundColor: colors.surface,
            justifyContent: "center",
          }}
        >
          <Text
            numberOfLines={1}
            style={{ fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.caption }}
          >
            {row.sideOutText}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
