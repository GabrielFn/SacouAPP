import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { RoundChip } from "../model/round-chips";

const { chips } = strings.rounds;

export interface HighlightDotProps {
  readonly color: string;
}

/** The orange dot of a leaf set only for this round; decorative, the pill is read as "só nesta rodada". */
export function HighlightDot({ color }: HighlightDotProps) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: tokens.sizes.highlightDot,
        height: tokens.sizes.highlightDot,
        borderRadius: tokens.radii.pill,
        backgroundColor: color,
      }}
    />
  );
}

export interface RoundChipsProps {
  readonly chips: readonly RoundChip[];
  /** The legend of grey and orange, shown when the round set some leaf of its own (screen 06). */
  readonly legend?: boolean;
}

/** The "Como vai ser" pills (not interactive, so exempt from the touch floor). */
export function RoundChips({ chips: list, legend = false }: RoundChipsProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}>
        {list.map((chip) => (
          <View
            key={chip.key}
            accessible
            accessibilityLabel={
              chip.highlighted
                ? `${chip.label}, ${strings.rounds.create.onlyThisRound}`
                : chip.label
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.s6,
              minHeight: tokens.sizes.statusPill,
              paddingHorizontal: tokens.spacing.m,
              borderRadius: tokens.radii.statusPill,
              borderWidth: tokens.borderWidths.thin,
              borderColor: colors.borderChip,
              backgroundColor: colors.surface,
            }}
          >
            {chip.highlighted ? <HighlightDot color={colors.primary} /> : null}
            <Text variant="bodyStrong">{chip.label}</Text>
          </View>
        ))}
      </View>
      {legend ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}>
          <Text variant="caption">{chips.legend}</Text>
          <HighlightDot color={colors.primary} />
          <Text variant="caption" style={{ flexShrink: 1 }}>
            {chips.legendOrange}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
