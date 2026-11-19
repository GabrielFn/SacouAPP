import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import { CloseIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { SheetSurface } from "./SheetPanel";

export interface CourtPageProps {
  readonly title: string;
  readonly subtitle: string | null;
  /** Without `onClose` the page has no cross: screen 25 is left only by its own buttons. */
  readonly closeLabel?: string;
  readonly onClose?: () => void;
  /** "Menu da partida" has the 28 title of MenuQuadra; "Corrigir" the 30 of Corrigir. */
  readonly titleSize?: "menu" | "large";
  /** The cream sheet of the prototypes (menu, corrections); the other pages keep the plain ground. */
  readonly sheet?: boolean;
  readonly children: ReactNode;
}

function PageHeader({
  title,
  subtitle,
  closeLabel,
  onClose,
  titleSize = "large",
}: Omit<CourtPageProps, "children">) {
  const { colors, tokens } = useTheme();
  const fontSize =
    titleSize === "menu" ? tokens.sheet.fontSizes.titleMenu : tokens.sheet.fontSizes.titleLarge;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <View style={{ flex: 1 }}>
        <Text
          variant="display"
          accessibilityRole="header"
          style={{ fontSize, lineHeight: fontSize }}
        >
          {title}
        </Text>
        {subtitle === null ? null : (
          <Text variant="caption" style={{ marginTop: tokens.spacing.xs }}>
            {subtitle}
          </Text>
        )}
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
  );
}

/**
 * The sheet the court opens over itself (menu, corrections; MenuQuadra and Corrigir): the title and the
 * cross at the top, and the body under them. It runs on its side like the court, inside the safe area.
 */
export function CourtPage({ children, sheet = false, ...header }: CourtPageProps) {
  if (sheet) {
    return (
      <SheetSurface placement="page" accessibilityLabel={header.title}>
        <PageHeader {...header} />
        {children}
      </SheetSurface>
    );
  }
  return <PlainPage {...header}>{children}</PlainPage>;
}

/** The page the other screens of the court open (end of set and match, substitution). */
function PlainPage({ title, subtitle, closeLabel, onClose, children }: CourtPageProps) {
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
