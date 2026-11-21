import type { MemberId } from "@sacou/match-engine";
import { Pressable, View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import type { BenchRow } from "../model/lineup-bench";

export interface BenchPickerProps {
  readonly row: BenchRow;
  readonly onToggle: (memberId: MemberId) => void;
}

/** The row "Banco do {time}" (R96): one toggle chip per reserve, or why nobody can go to the bench. */
export function BenchPicker({ row, onToggle }: BenchPickerProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <Text variant="bodyStrong">{row.label}</Text>
      {row.note === null ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}>
          {row.options.map((option) => (
            <Pressable
              key={option.memberId}
              accessibilityRole="checkbox"
              accessibilityLabel={texts.benchOption(option.name, option.checked)}
              accessibilityState={{ checked: option.checked }}
              onPress={() => {
                onToggle(option.memberId);
              }}
              style={{
                minHeight: tokens.sizes.chip,
                paddingHorizontal: tokens.spacing.m,
                justifyContent: "center",
                borderRadius: tokens.radii.field,
                borderWidth: tokens.borderWidths.thin,
                borderColor: option.checked ? colors.selectOutline : colors.borderCard,
                backgroundColor: option.checked ? colors.selectFill : colors.surface,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontFamily: option.checked ? fontFamilies.body700 : fontFamilies.body500,
                }}
              >
                {option.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text variant="muted">{row.note}</Text>
      )}
    </View>
  );
}
