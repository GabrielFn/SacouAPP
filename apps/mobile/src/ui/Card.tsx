import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../theme/theme-context";

export interface CardProps {
  readonly children: ReactNode;
  /** Optional colored strip on the left edge. */
  readonly stripColor?: string;
}

export function Card({ children, stripColor }: CardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.card,
        overflow: "hidden",
      }}
    >
      {stripColor ? (
        <View style={{ paddingHorizontal: tokens.spacing.s, backgroundColor: stripColor }} />
      ) : null}
      <View style={{ flex: 1, padding: tokens.spacing.l, gap: tokens.spacing.xs }}>{children}</View>
    </View>
  );
}
