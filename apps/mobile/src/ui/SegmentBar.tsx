import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export interface SegmentBarOption<T> {
  readonly value: T;
  readonly label: string;
}

/** How the bar is announced: tabs (selected) or a radio group (checked, maybe disabled). */
export type SegmentBarRole = "tabs" | "radios";

export interface SegmentBarProps<T> {
  readonly options: readonly SegmentBarOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
  readonly role: SegmentBarRole;
  readonly disabled?: boolean;
  readonly singleLine?: boolean;
}

const SINGLE_LINE = 1;

function itemAccessibility(role: SegmentBarRole, active: boolean, disabled: boolean) {
  return role === "tabs"
    ? { accessibilityRole: "tab" as const, accessibilityState: { selected: active } }
    : { accessibilityRole: "radio" as const, accessibilityState: { checked: active, disabled } };
}

/** The shared look of the segmented control (.sg/.seg): the options share the width, the chosen one is the white pill. */
export function SegmentBar<T extends string | number | boolean>({
  options,
  selected,
  onSelect,
  accessibilityLabel,
  role,
  disabled = false,
  singleLine = false,
}: SegmentBarProps<T>) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityRole={role === "tabs" ? "tablist" : "radiogroup"}
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
            key={String(option.value)}
            {...itemAccessibility(role, active, disabled)}
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
              backgroundColor: active ? colors.surface : "transparent",
            }}
          >
            <Text
              numberOfLines={singleLine ? SINGLE_LINE : undefined}
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
