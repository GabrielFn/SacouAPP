import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { palette } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type { StatsCell } from "../model/round-detail";

export interface RoundStatsPanelProps {
  readonly cells: readonly StatsCell[];
}

/** The dark panel with the counts. Two cells at most: money is out of the pilot (ADR 0046). */
export function RoundStatsPanel({ cells }: RoundStatsPanelProps) {
  const { colors, tokens } = useTheme();
  if (cells.length === 0) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: tokens.spacing.m,
        padding: tokens.spacing.l,
        borderRadius: tokens.radii.card,
        backgroundColor: colors.text,
      }}
    >
      {cells.map((cell) => (
        <View key={cell.label} accessible style={{ flex: 1, gap: tokens.spacing.xs }}>
          <Text variant="display" displaySize="displayMedium" style={{ color: palette.ballYellow }}>
            {cell.value}
          </Text>
          <Text variant="caption" style={{ color: colors.background }}>
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
