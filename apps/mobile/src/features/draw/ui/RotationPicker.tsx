import type { FormationSystem } from "@sacou/volley-rules";
import { Pressable, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { Option } from "../model/pre-game-selectors";

const OPTION_FLEX_BASIS = "22%";

export interface RotationPickerProps {
  readonly label: string;
  readonly options: readonly Option<FormationSystem>[];
  readonly selected: FormationSystem;
  readonly disabled: boolean;
  readonly onSelect: (system: FormationSystem) => void;
}

/** The systems of one team (PreJogo.dc.html radiogroup): one "Livre", no "6x0" nor "Pro" (D9). */
export function RotationPicker({
  label,
  options,
  selected,
  disabled,
  onSelect,
}: RotationPickerProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: "row", gap: tokens.spacing.s6 }}
    >
      {options.map((option) => {
        const checked = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => {
              onSelect(option.value);
            }}
            style={{
              flexGrow: 1,
              flexBasis: OPTION_FLEX_BASIS,
              minHeight: tokens.sizes.systemButton,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.radii.field,
              borderWidth: tokens.borderWidths.thin,
              borderColor: checked ? colors.text : colors.borderChip,
              backgroundColor: checked ? colors.text : colors.surface,
            }}
          >
            <Text
              variant="display"
              displaySize="displayBlock"
              style={{ color: checked ? colors.background : colors.text }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
