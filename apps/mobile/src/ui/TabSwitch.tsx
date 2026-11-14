import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export interface TabOption<T> {
  readonly value: T;
  readonly label: string;
}

export interface TabSwitchProps<T> {
  readonly options: readonly TabOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
}

/** Tabs drawn as the segmented control (Membros.dc.html .seg), announced as tabs, not as radios. */
export function TabSwitch<T extends string>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: TabSwitchProps<T>) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: "row",
        padding: tokens.spacing.xs,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.segmentSurface,
      }}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              onSelect(option.value);
            }}
            style={{
              flex: 1,
              minHeight: tokens.sizes.segment,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: tokens.radii.field,
              backgroundColor: active ? colors.surface : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? colors.text : colors.textMuted,
                fontFamily: active ? fontFamilies.body700 : fontFamilies.body500,
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
