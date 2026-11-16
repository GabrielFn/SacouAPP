import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

export interface LinesCardProps {
  readonly lines: readonly string[];
}

/** A white card of plain lines with dividers: what goes in the export (30a) and what the deletion does (30b). */
export function LinesCard({ lines }: LinesCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
      }}
    >
      {lines.map((line, index) => (
        <View
          key={line}
          style={{
            minHeight: tokens.sizes.settingRowMin,
            justifyContent: "center",
            paddingHorizontal: tokens.spacing.s14,
            paddingVertical: tokens.spacing.s10,
            borderTopWidth: index === 0 ? 0 : tokens.borderWidths.thin,
            borderTopColor: colors.borderDivider,
          }}
        >
          <Text variant="body">{line}</Text>
        </View>
      ))}
    </View>
  );
}
