import { View } from "react-native";
import Svg, { G, Rect } from "react-native-svg";

import type { ScaledCardMeasures } from "../../../theme/scale";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type { CardStat } from "../model/player-card";
import {
  cardLayout,
  GLYPH_COLUMNS,
  GLYPH_RADIUS,
  GLYPH_ROWS,
  GLYPH_SQUARE,
  GLYPH_VIEW_BOX,
} from "./player-card.layout.data";
import { cardTextLines } from "./player-card-budget";

export interface StatsGridProps {
  readonly stats: readonly CardStat[];
  readonly measures: ScaledCardMeasures;
}

export function StatsGrid({ stats, measures: m }: StatsGridProps) {
  const { colors } = useTheme();
  const lines = cardTextLines(m);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: m.statRowGap,
      }}
    >
      {stats.map((stat) => (
        <View key={stat.key} style={{ width: cardLayout.statColumn, alignItems: "center" }}>
          <Text
            tabular
            numberOfLines={1}
            style={{
              color: colors.onPanel,
              fontFamily: fontFamilies.display800,
              fontSize: m.statValueFont,
              lineHeight: lines.statValue,
            }}
          >
            {stat.value}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: colors.cardLabel,
              fontSize: m.statLabelFont,
              lineHeight: lines.statLabel,
            }}
          >
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export interface PositionGlyphProps {
  readonly width: number;
  readonly height: number;
}

/** Six squares, the last one lit: decoration of a position, the same for all (question 162). */
export function PositionGlyph({ width, height }: PositionGlyphProps) {
  const { colors } = useTheme();
  const cells = GLYPH_ROWS.flatMap((y) => GLYPH_COLUMNS.map((x) => ({ x, y })));
  const lit = cells.length - 1;
  return (
    <Svg width={width} height={height} viewBox={GLYPH_VIEW_BOX}>
      {cells.map((cell, index) => (
        <G
          key={`${String(cell.x)}-${String(cell.y)}`}
          transform={`translate(${String(cell.x)} ${String(cell.y)})`}
        >
          <Rect
            width={GLYPH_SQUARE}
            height={GLYPH_SQUARE}
            rx={GLYPH_RADIUS}
            fill={index === lit ? colors.accent : colors.onPanel}
          />
        </G>
      ))}
    </Svg>
  );
}
