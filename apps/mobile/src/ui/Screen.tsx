import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/theme-context";

export interface ScreenProps {
  readonly children: ReactNode;
  /** A tab screen sits above the tab bar, which already covers the bottom safe area. */
  readonly aboveTabBar?: boolean;
  /** The content scrolls when it is taller than the window. */
  readonly scroll?: boolean;
}

export function Screen({ children, aboveTabBar = false, scroll = false }: ScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const content = {
    paddingTop: insets.top + tokens.spacing.xl,
    paddingBottom: (aboveTabBar ? 0 : insets.bottom) + tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.l,
  };
  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={content}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, ...content }}>{children}</View>
  );
}
