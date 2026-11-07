import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/theme-context";

export interface ScreenProps {
  readonly children: ReactNode;
}

export function Screen({ children }: ScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + tokens.spacing.xl,
        paddingBottom: insets.bottom + tokens.spacing.xl,
        paddingHorizontal: tokens.spacing.xl,
        gap: tokens.spacing.l,
      }}
    >
      {children}
    </View>
  );
}
