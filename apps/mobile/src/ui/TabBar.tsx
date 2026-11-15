import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "../strings/pt-BR";
import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export interface TabBarFrameProps {
  readonly children: ReactNode;
}

/** The bar itself: a top line, the tabs side by side, and the bottom safe area (no fixed height). */
export function TabBarFrame({ children }: TabBarFrameProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={strings.groups.tabs.navigation}
      style={{
        flexDirection: "row",
        backgroundColor: colors.background,
        borderTopWidth: tokens.borderWidths.thin,
        borderTopColor: colors.borderDivider,
        paddingBottom: insets.bottom,
      }}
    >
      {children}
    </View>
  );
}

export interface TabBarItemProps {
  readonly label: string;
  /** Draws the icon in the color the tab asks for. */
  readonly renderIcon: (color: string) => ReactNode;
  /** The next two come from the router's `TabTrigger`, which passes them to its child. */
  readonly isFocused?: boolean;
  readonly onPress?: () => void;
}

/** One tab: icon over label, the active one with the orange pill behind the icon (Grupos.dc.html). */
export function TabBarItem({ label, renderIcon, isFocused = false, onPress }: TabBarItemProps) {
  const { colors, tokens } = useTheme();
  const color = isFocused ? colors.onPrimary : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: tokens.sizes.tabItem,
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.xs,
      }}
    >
      <View
        style={{
          width: tokens.sizes.tabPillWidth,
          height: tokens.sizes.tabPillHeight,
          borderRadius: tokens.radii.tabPill,
          backgroundColor: isFocused ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {renderIcon(color)}
      </View>
      <Text
        style={{
          color: isFocused ? colors.text : colors.textMuted,
          fontFamily: isFocused ? fontFamilies.body700 : fontFamilies.body600,
          fontSize: tokens.fontSizes.caption,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
