import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { RankingRowView } from "../model/beach-ranking-view";

const { summary } = strings;

export interface RankingListProps {
  readonly rows: readonly RankingRowView[];
}

/** "Ranking do dia" of the sand (ResumoAreia.dc.html): one row per team, in the order of the server. */
export function RankingList({ rows }: RankingListProps) {
  const { colors, tokens } = useTheme();
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="bodyStrong" accessibilityRole="header">
        {summary.rankingTitle}
      </Text>
      <View
        accessibilityRole="list"
        style={{
          backgroundColor: colors.surface,
          borderRadius: tokens.radii.tile,
          borderWidth: tokens.borderWidths.thin,
          borderColor: colors.borderCard,
          overflow: "hidden",
        }}
      >
        {rows.map((row, index) => (
          <View
            key={row.key}
            accessible
            accessibilityRole="text"
            accessibilityLabel={row.accessibilityLabel}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.m,
              minHeight: tokens.sizes.iconButton,
              paddingVertical: tokens.spacing.xs,
              paddingHorizontal: tokens.spacing.s14,
              borderTopWidth: index === 0 ? 0 : tokens.borderWidths.thin,
              borderTopColor: colors.borderDivider,
            }}
          >
            <Text variant="display" displaySize="teamTitle" style={{ minWidth: tokens.spacing.xxl }}>
              {String(row.position)}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
              {row.name}
            </Text>
            <Text variant="caption" style={{ color: colors.textMuted, flexShrink: 1 }}>
              {row.record}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
