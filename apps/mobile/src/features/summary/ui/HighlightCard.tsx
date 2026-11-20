import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import { teamSwatch } from "../../draw/ui/team-swatch";
import type { HighlightView } from "../model/summary-view";

export interface HighlightCardProps {
  readonly highlight: HighlightView;
}

/** "Time que mais venceu" and "Maior sequência": a strip in the color of the side, then the numbers. */
export function HighlightCard({ highlight }: HighlightCardProps) {
  const { colors, tokens } = useTheme();
  const strip = teamSwatch(highlight.color, colors).fill;
  return (
    <View
      accessible
      accessibilityLabel={`${highlight.title}: ${highlight.label}, ${highlight.figure}`}
      style={{
        flex: 1,
        flexDirection: "row",
        overflow: "hidden",
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
      }}
    >
      <View style={{ width: tokens.spacing.s6, backgroundColor: strip }} />
      <View
        style={{
          flex: 1,
          gap: tokens.spacing.xs,
          paddingVertical: tokens.spacing.m,
          paddingHorizontal: tokens.spacing.s14,
        }}
      >
        <Text variant="caption">{highlight.title}</Text>
        <Text variant="display" displaySize="displayLevelCard">
          {highlight.label}
        </Text>
        <Text variant="bodyStrong">{highlight.figure}</Text>
      </View>
    </View>
  );
}
