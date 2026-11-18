import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../../../theme/theme-context";

export interface SheetPanelProps {
  readonly children: ReactNode;
}

/** The framed panel of screen 24 where a question is asked ("Voltar o jogo para...?", "Girar"). */
export function SheetPanel({ children }: SheetPanelProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityViewIsModal
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        padding: tokens.spacing.l,
        gap: tokens.spacing.s,
      }}
    >
      {children}
    </View>
  );
}
