import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { PlayerChipView } from "../model/draw-view";
import { PlayerChip } from "./PlayerChip";

export interface ReservesRowProps {
  readonly reserves: readonly PlayerChipView[];
  readonly disabled: boolean;
  readonly onTap: (memberId: string) => void;
}

/** "Reservas na fila" with "1 · Davi 3,5" in the order of the queue; nothing without reserves. */
export function ReservesRow({ reserves, disabled, onTap }: ReservesRowProps) {
  const { colors, tokens } = useTheme();
  if (reserves.length === 0) return null;
  return (
    <View
      style={{
        padding: tokens.spacing.s10,
        gap: tokens.spacing.s6,
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.reservesRow,
        borderWidth: tokens.borderWidths.thin,
        borderStyle: "dashed",
        borderColor: colors.borderDashed,
      }}
    >
      <Text variant="bodyStrong" accessibilityRole="header">
        {strings.draw.reservesTitle}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 }}>
        {reserves.map((chip) => (
          <View key={chip.memberId} style={{ flexGrow: 1, flexBasis: "45%" }}>
            <PlayerChip chip={chip} disabled={disabled} onPress={onTap} />
          </View>
        ))}
      </View>
    </View>
  );
}
