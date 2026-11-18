import { View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { OrderCell } from "../model/lineup-selectors";

export interface OfficialOrderProps {
  readonly cells: readonly OrderCell[];
  readonly benchLine: string;
}

/** "Ordem oficial" from 1 to 6, the server's cell highlighted, and the bench line (Escalacao.dc.html). */
export function OfficialOrder({ cells, benchLine }: OfficialOrderProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}>
        <Text variant="bodyStrong">{texts.officialOrder}</Text>
        <Text variant="muted" style={{ marginLeft: "auto" }}>
          {benchLine}
        </Text>
      </View>
      <View
        accessibilityRole="list"
        accessibilityLabel={texts.officialOrderLabel}
        style={{ flexDirection: "row", gap: tokens.spacing.xs }}
      >
        {cells.map((cell) => (
          <View
            key={cell.slot}
            accessible
            style={{
              flex: 1,
              minHeight: tokens.sizes.orderCell,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.radii.field,
              borderWidth: tokens.borderWidths.thin,
              borderColor: cell.isServer ? colors.text : colors.borderCard,
              backgroundColor: cell.isServer ? colors.waitingFill : colors.surface,
            }}
          >
            <Text variant="display" tabular style={{ color: colors.textMuted }}>
              {cell.slot}
            </Text>
            <Text variant="caption" numberOfLines={1} style={{ color: colors.text }}>
              {cell.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
