import type { RotationSlot } from "@sacou/volley-rules";
import { Pressable, View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { Choice } from "../model/lineup-selectors";

export interface RotationSelectorProps {
  readonly label: string;
  readonly options: readonly Choice<RotationSlot>[];
  readonly onSelect: (zone: RotationSlot) => void;
}

/** "Rotação 1…6" (Escalacao.dc.html radiogroup): the zone of the setter, absolute (D4). */
export function RotationSelector({ label, options, onSelect }: RotationSelectorProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: "row", gap: tokens.spacing.s6 }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={texts.rotationOption(option.value)}
          accessibilityState={{ checked: option.checked }}
          onPress={() => {
            onSelect(option.value);
          }}
          style={{
            flex: 1,
            minHeight: tokens.sizes.segment,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: tokens.radii.field,
            borderWidth: tokens.borderWidths.thin,
            borderColor: option.checked ? colors.text : colors.borderChip,
            backgroundColor: option.checked ? colors.text : colors.surface,
          }}
        >
          <Text
            variant="display"
            tabular
            style={{ color: option.checked ? colors.background : colors.text }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
