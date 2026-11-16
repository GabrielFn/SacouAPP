import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { StatsCell } from "../model/round-detail";

export interface RoundStatsPanelProps {
  readonly cells: readonly StatsCell[];
  /** The confirmed cell (the first) opens the list (question 47); `null` keeps it a plain count. */
  readonly onOpenConfirmed: (() => void) | null;
}

export interface StatsCellViewProps {
  readonly cell: StatsCell;
}

function StatsCellView({ cell }: StatsCellViewProps) {
  const { colors } = useTheme();
  return (
    <>
      <Text variant="display" displaySize="displayMedium" style={{ color: colors.panelAccent }}>
        {cell.value}
      </Text>
      <Text variant="caption" style={{ color: colors.onPanel }}>
        {cell.label}
      </Text>
    </>
  );
}

/** The dark panel with the counts. Two cells at most: money is out of the pilot (ADR 0046). */
export function RoundStatsPanel({ cells, onOpenConfirmed }: RoundStatsPanelProps) {
  const { colors, tokens } = useTheme();
  if (cells.length === 0) return null;
  const cellStyle = {
    flex: 1,
    gap: tokens.spacing.xs,
    minHeight: tokens.sizes.minTouchTarget,
  } as const;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: tokens.spacing.m,
        padding: tokens.spacing.l,
        borderRadius: tokens.radii.card,
        backgroundColor: colors.panelSurface,
      }}
    >
      {cells.map((cell, index) =>
        index === 0 && onOpenConfirmed !== null ? (
          <Pressable
            key={cell.label}
            accessibilityRole="button"
            accessibilityLabel={strings.rounds.detail.openConfirmed(cell.value)}
            onPress={onOpenConfirmed}
            style={cellStyle}
          >
            <StatsCellView cell={cell} />
          </Pressable>
        ) : (
          <View key={cell.label} accessible style={cellStyle}>
            <StatsCellView cell={cell} />
          </View>
        ),
      )}
    </View>
  );
}
