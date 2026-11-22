import type { ReactNode } from "react";
import { Pressable } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";
import { Text } from "./Text";

export interface PillButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /** Drawn before the label, in the color of the pill's text. */
  readonly renderIcon?: (color: string) => ReactNode;
}

/** The dark pill of a screen header ("+ Criar grupo", "+ Nova rodada"); the touch target is 44 or more. */
export function PillButton({ label, onPress, renderIcon }: PillButtonProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: tokens.sizes.iconButton,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s6,
        paddingHorizontal: tokens.spacing.l,
        borderRadius: tokens.radii.pill,
        backgroundColor: colors.text,
      }}
    >
      {renderIcon?.(colors.background)}
      <Text style={{ color: colors.background, fontFamily: fontFamilies.body700 }}>{label}</Text>
    </Pressable>
  );
}
