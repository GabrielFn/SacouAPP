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
  /** The content is centered and never wider than this (the pages of the court on its side). */
  readonly maxContentWidth?: number;
}

export function Screen({
  children,
  aboveTabBar = false,
  scroll = false,
  maxContentWidth,
}: ScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const content = {
    paddingTop: insets.top + tokens.spacing.xl,
    paddingBottom: (aboveTabBar ? 0 : insets.bottom) + tokens.spacing.xl,
    paddingLeft: insets.left + tokens.spacing.xl,
    paddingRight: insets.right + tokens.spacing.xl,
    gap: tokens.spacing.l,
  };
  const body =
    maxContentWidth === undefined ? (
      children
    ) : (
      <View style={{ width: "100%", maxWidth: maxContentWidth, gap: tokens.spacing.l }}>
        {children}
      </View>
    );
  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          ...content,
          alignItems: maxContentWidth === undefined ? undefined : "center",
        }}
      >
        {body}
      </ScrollView>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: maxContentWidth === undefined ? undefined : "center",
        ...content,
      }}
    >
      {body}
    </View>
  );
}
