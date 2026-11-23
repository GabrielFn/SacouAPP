import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";

export interface RoundSectionCardProps {
  /** The name of the region for the screen reader; none when the card has no title of its own. */
  readonly label?: string;
  readonly children: ReactNode;
}

/** The white card of screen 26 ("Confirmados", "Times"): surface, thin border, the card radius. */
export function RoundSectionCard({ label, children }: RoundSectionCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      {...(label === undefined ? {} : { accessibilityRole: "summary", accessibilityLabel: label })}
      style={{
        gap: tokens.spacing.s,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      {children}
    </View>
  );
}
