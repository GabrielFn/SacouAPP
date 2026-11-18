import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import { CloseIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";

export interface CourtPageProps {
  readonly title: string;
  readonly subtitle: string | null;
  /** Without `onClose` the page has no cross: screen 25 is left only by its own buttons. */
  readonly closeLabel?: string;
  readonly onClose?: () => void;
  readonly children: ReactNode;
}

/**
 * The page the court opens over itself (menu, corrections): the title and the cross at the top, and
 * the body under them. It runs on its side like the court, inside the safe area, never wider than needed.
 */
export function CourtPage({ title, subtitle, closeLabel, onClose, children }: CourtPageProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + tokens.spacing.m,
        paddingBottom: insets.bottom + tokens.spacing.m,
        paddingLeft: insets.left + tokens.spacing.xl,
        paddingRight: insets.right + tokens.spacing.xl,
        gap: tokens.spacing.s10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <View style={{ flex: 1 }}>
          <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
            {title}
          </Text>
          {subtitle === null ? null : <Text variant="muted">{subtitle}</Text>}
        </View>
        {onClose === undefined ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            onPress={onClose}
            style={{
              minWidth: tokens.sizes.iconButton,
              minHeight: tokens.sizes.iconButton,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseIcon color={colors.text} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}
