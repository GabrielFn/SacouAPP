import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { PlayerChipView, TeamCardView } from "../model/draw-view";
import { PlayerChip } from "./PlayerChip";
import { teamSwatch } from "./team-swatch";

const COLUMNS = 3;

function rowsOf(players: readonly PlayerChipView[]): readonly (readonly PlayerChipView[])[] {
  return Array.from({ length: Math.ceil(players.length / COLUMNS) }, (_, row) =>
    players.slice(row * COLUMNS, (row + 1) * COLUMNS),
  );
}

export interface DrawTeamCardProps {
  readonly card: TeamCardView;
  readonly disabled: boolean;
  readonly onTap: (memberId: string) => void;
}

/** A team of screen 07: the color strip, the letter, the name, "nota 3,7" and a grid of three columns. */
export function DrawTeamCard({ card, disabled, onTap }: DrawTeamCardProps) {
  const { colors, tokens } = useTheme();
  const swatch = teamSwatch(card.team.color, colors);
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        overflow: "hidden",
      }}
    >
      <View style={{ width: tokens.sizes.teamStrip, backgroundColor: swatch.fill }} />
      <View style={{ flex: 1, padding: tokens.spacing.s10, gap: tokens.spacing.s6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
          <View
            style={{
              width: tokens.sizes.teamBadge,
              aspectRatio: 1,
              borderRadius: tokens.radii.playerChip,
              backgroundColor: swatch.fill,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="display" style={{ color: swatch.onFill }}>
              {card.team.letter}
            </Text>
          </View>
          <Text
            variant="display"
            accessibilityRole="header"
            style={{ flex: 1, fontSize: tokens.fontSizes.teamTitle }}
          >
            {card.team.name}
          </Text>
          <Text variant="bodyStrong" tabular>
            {card.level}
          </Text>
        </View>
        {rowsOf(card.players).map((row) => (
          <View key={row[0]?.memberId} style={{ flexDirection: "row", gap: tokens.spacing.s6 }}>
            {row.map((chip) => (
              <PlayerChip key={chip.memberId} chip={chip} disabled={disabled} onPress={onTap} />
            ))}
            {Array.from({ length: COLUMNS - row.length }, (_, gap) => (
              <View key={`gap-${String(gap)}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
