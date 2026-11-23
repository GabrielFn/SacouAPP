import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { StatTileModel } from "../model/player-card";

/** "vitórias · 50%" and "vezes MVP" break between words at a large system font instead of being cut (R99). */
export const STAT_LABEL_LINES = 2;

export interface StatTileProps {
  readonly tile: StatTileModel;
}

/** One of the six numbers of "Estatísticas" (`.st`): the number big, its name under it. */
export function StatTile({ tile }: StatTileProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${tile.value} ${tile.label}`}
      style={{
        flexGrow: 1,
        flexBasis: "30%",
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.button,
        paddingVertical: tokens.spacing.s10,
        paddingHorizontal: tokens.spacing.m,
      }}
    >
      <Text variant="display" tabular numberOfLines={1} style={{ fontSize: tokens.statTileValue }}>
        {tile.value}
      </Text>
      <Text variant="caption" numberOfLines={STAT_LABEL_LINES}>
        {tile.label}
      </Text>
    </View>
  );
}
