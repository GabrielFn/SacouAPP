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
  /** Fixed at the foot, under the scrolling content (the main button of a form). */
  readonly footer?: ReactNode;
}

export function Screen({ children, aboveTabBar = false, scroll = false, footer }: ScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const content = {
    paddingTop: insets.top + tokens.spacing.xl,
    paddingBottom: (aboveTabBar || footer ? 0 : insets.bottom) + tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    gap: tokens.spacing.l,
  };
  if (footer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: tokens.spacing.xl,
            paddingTop: tokens.spacing.m,
            paddingBottom: insets.bottom + tokens.spacing.xl,
            gap: tokens.spacing.s10,
          }}
        >
          {footer}
        </View>
      </View>
    );
  }
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
