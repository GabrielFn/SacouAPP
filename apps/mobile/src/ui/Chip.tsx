import { Pressable } from "react-native";

import { useTheme } from "../theme/theme-context";

import { CheckIcon } from "./Icons";
import { Text } from "./Text";

export interface ChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly kind?: "radio" | "toggle";
}

export function Chip({ label, selected, onPress, kind = "radio" }: ChipProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole={kind === "radio" ? "radio" : "checkbox"}
      accessibilityState={kind === "radio" ? { selected } : { checked: selected }}
      onPress={onPress}
      style={{
        minHeight: tokens.sizes.chip,
        borderRadius: tokens.radii.pill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: selected ? colors.text : colors.borderChip,
        backgroundColor: selected ? colors.text : colors.surface,
        paddingHorizontal: tokens.spacing.l,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.s,
      }}
    >
      {kind === "toggle" && selected ? <CheckIcon color={colors.background} /> : null}
      <Text variant="bodyStrong" style={{ color: selected ? colors.background : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}
