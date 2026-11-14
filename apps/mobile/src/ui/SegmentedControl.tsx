import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { Text } from "./Text";

export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T> {
  readonly options: readonly SegmentOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
}

/** The segmented control (.sg/.seg): the options share the width, the chosen one is the white pill. */
export function SegmentedControl<T extends string | number | boolean>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
  disabled = false,
}: SegmentedControlProps<T>) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: "row",
        padding: tokens.spacing.xs,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.segmentSurface,
      }}
    >
      {options.map((option) => {
        const checked = option.value === selected;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => {
              onSelect(option.value);
            }}
            style={{
              flex: 1,
              minHeight: tokens.sizes.segment,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.radii.field,
              backgroundColor: checked ? colors.surface : "transparent",
            }}
          >
            <Text
              style={{
                color: checked ? colors.text : colors.textMuted,
                fontFamily: checked ? fontFamilies.body700 : fontFamilies.body500,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
