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
  /** The content is centered and never wider than this (the pages of the court on its side). */
  readonly maxContentWidth?: number;
}

export function Screen({
  children,
  aboveTabBar = false,
  scroll = false,
  footer,
  maxContentWidth,
}: ScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  // A scrolling body leaves the status bar to a fixed strip, so the text never rolls under it.
  const topStrip = <View style={{ height: insets.top, backgroundColor: colors.background }} />;
  const content = {
    paddingTop: tokens.spacing.xl,
    paddingBottom: (aboveTabBar || footer ? 0 : insets.bottom) + tokens.spacing.xl,
    paddingLeft: insets.left + tokens.spacing.xl,
    paddingRight: insets.right + tokens.spacing.xl,
    gap: tokens.spacing.l,
  };
  const centered = maxContentWidth === undefined ? undefined : "center";
  const body =
    maxContentWidth === undefined ? (
      children
    ) : (
      <View style={{ width: "100%", maxWidth: maxContentWidth, gap: tokens.spacing.l }}>
        {children}
      </View>
    );
  if (footer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topStrip}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ ...content, alignItems: centered }}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
        <View
          style={{
            paddingLeft: insets.left + tokens.spacing.xl,
            paddingRight: insets.right + tokens.spacing.xl,
            paddingTop: tokens.spacing.m,
            // Above the tab bar (the bar "EM QUADRA" of the home), the bar already covers the safe area.
            paddingBottom: aboveTabBar ? tokens.spacing.m : insets.bottom + tokens.spacing.xl,
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {topStrip}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            ...content,
            alignItems: centered,
          }}
        >
          {body}
        </ScrollView>
      </View>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: centered,
        ...content,
        paddingTop: insets.top + tokens.spacing.xl,
      }}
    >
      {body}
    </View>
  );
}
