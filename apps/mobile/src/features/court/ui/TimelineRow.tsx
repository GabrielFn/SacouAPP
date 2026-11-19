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
  /** "Autor": answers or changes who scored it on screen 31 (D10). */
  readonly onAuthor?: (eventId: string) => void;
}

export interface AuthorLineProps {
  readonly row: TimelineRowModel;
  readonly authorText: string;
  readonly onAuthor: (eventId: string) => void;
}

/** Who scored the line and the button that opens screen 31 for it; outside the row, not nested. */
function AuthorLine({ row, authorText, onAuthor }: AuthorLineProps) {
  const { colors, tokens } = useTheme();
  const { attribution } = strings.courtPlayers;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingHorizontal: tokens.spacing.s10,
      }}
    >
      <Text variant="muted" numberOfLines={1} style={{ flex: 1 }}>
        {authorText}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={attribution.authorButtonLabel(row.scoreText)}
        onPress={() => {
          onAuthor(row.eventId);
        }}
        style={{
          minHeight: tokens.sizes.minTouchTarget,
          minWidth: tokens.sizes.minTouchTarget,
          paddingHorizontal: tokens.spacing.s10,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: tokens.radii.field,
          borderWidth: tokens.borderWidths.thin,
          borderColor: colors.text,
        }}
      >
        <Text variant="bodyStrong">{attribution.authorButton}</Text>
      </Pressable>
    </View>
  );
}

export interface PointLineProps {
  readonly row: TimelineRowModel;
  readonly onPress: (eventId: string) => void;
}

function PointLine({ row, onPress }: PointLineProps) {
  const { colors, tokens } = useTheme();
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
        borderWidth: row.selected ? tokens.borderWidths.thick : undefined,
        borderColor: colors.text,
      }}
    >
      <Text
        tabular
        style={{
          flexBasis: "22%",
          flexShrink: 0,
          fontFamily: fontFamilies.display800,
          fontSize: tokens.sheet.fontSizes.rowScore,
          lineHeight: tokens.sheet.fontSizes.rowScore,
          textDecorationLine: row.willUndo ? "line-through" : "none",
          ...mutedColor,
        }}
      >
        {row.scoreText}
      </Text>
      <View
        style={{
          width: tokens.sheet.sizes.teamMark,
          height: tokens.sheet.sizes.teamMark,
          borderRadius: tokens.sheet.radii.teamMark,
          backgroundColor: palette.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: palette.onFill,
            fontFamily: fontFamilies.display800,
            fontSize: tokens.sheet.fontSizes.teamLetter,
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
            minHeight: tokens.sizes.roleBadge,
            borderRadius: tokens.radii.roleBadge,
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

/** One point of screen 24: the score after it, the team, who served and the side-out. */
export function TimelineRow({ row, onPress, onAuthor }: TimelineRowProps) {
  const { authorText } = row;
  return (
    <View>
      <PointLine row={row} onPress={onPress} />
      {authorText === null || onAuthor === undefined ? null : (
        <AuthorLine row={row} authorText={authorText} onAuthor={onAuthor} />
      )}
    </View>
  );
}
