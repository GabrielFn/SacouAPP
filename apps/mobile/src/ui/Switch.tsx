import { Pressable, View } from "react-native";

import { useTheme } from "../theme/theme-context";

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
}

const DISABLED_OPACITY = 0.6;

/** The switch of the canvas (.sw/.tr): a 50 x 30 track in a 58 x 44 touch target. */
export function Switch({ checked, onChange, accessibilityLabel, disabled = false }: SwitchProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => {
        onChange(!checked);
      }}
      style={{
        width: tokens.sizes.switchTargetWidth,
        minHeight: tokens.sizes.switchTarget,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? DISABLED_OPACITY : 1,
      }}
    >
      <View
        style={{
          width: tokens.sizes.switchTrackWidth,
          height: tokens.sizes.switchTrackHeight,
          borderRadius: tokens.radii.pill,
          backgroundColor: checked ? colors.primary : colors.trackOff,
          padding: tokens.sizes.switchInset,
          justifyContent: "center",
          alignItems: checked ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            width: tokens.sizes.switchKnob,
            height: tokens.sizes.switchKnob,
            borderRadius: tokens.radii.pill,
            backgroundColor: colors.surface,
          }}
        />
      </View>
    </Pressable>
  );
}
