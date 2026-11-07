import type { ReactNode } from "react";
import { Pressable } from "react-native";

import { useTheme } from "../theme/theme-context";

export interface IconButtonProps {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

export function IconButton({ accessibilityLabel, onPress, children }: IconButtonProps) {
  const { colors, tokens } = useTheme();
  const size = tokens.sizes.iconButton;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        minWidth: size,
        minHeight: size,
        borderRadius: size,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderField,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Pressable>
  );
}
