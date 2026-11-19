import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import { CloseIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { SheetSurface } from "./SheetPanel";

/** "menu": the 28 title of MenuQuadra; "large": the 30 of Corrigir; "plain": the other pages. */
export type PageTitleSize = "menu" | "large" | "plain";

export interface PageHeaderProps {
  readonly title: string;
  readonly subtitle: string | null;
  /** Without `onClose` the page has no cross: screen 25 is left only by its own buttons. */
  readonly closeLabel?: string;
  readonly onClose?: () => void;
  readonly titleSize: PageTitleSize;
}

export interface CourtPageProps {
  readonly title: string;
  readonly subtitle: string | null;
  readonly closeLabel?: string;
  readonly onClose?: () => void;
  /** The cream sheet of the prototypes (menu, corrections); the other pages keep the plain ground. */
  readonly sheet?: boolean;
  readonly titleSize?: PageTitleSize;
  readonly children: ReactNode;
}

export interface PageTitleProps {
  readonly title: string;
  readonly titleSize: PageTitleSize;
}

function PageTitle({ title, titleSize }: PageTitleProps) {
  const { tokens } = useTheme();
  const fontSize =
    titleSize === "menu" ? tokens.sheet.fontSizes.titleMenu : tokens.sheet.fontSizes.titleLarge;
  return titleSize === "plain" ? (
    <Text variant="display" displaySize="displayTitleSmall" accessibilityRole="header">
      {title}
    </Text>
  ) : (
    <Text variant="display" accessibilityRole="header" style={{ fontSize, lineHeight: fontSize }}>
      {title}
    </Text>
  );
}

function PageHeader({ title, subtitle, closeLabel, onClose, titleSize }: PageHeaderProps) {
  const { colors, tokens } = useTheme();
  const plain = titleSize === "plain";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <View style={{ flex: 1 }}>
        <PageTitle title={title} titleSize={titleSize} />
        {subtitle === null ? null : (
          <Text
            variant={plain ? "muted" : "caption"}
            style={{ marginTop: plain ? undefined : tokens.spacing.xs }}
          >
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
 * The page the court opens over itself. With `sheet` it is the cream sheet of MenuQuadra and Corrigir;
 * without, the plain ground of the end of set and match and of the substitution. The title and the cross
 * are at the top and the body is under them, inside the safe area, on its side like the court.
 */
export function CourtPage({
  title,
  subtitle,
  closeLabel,
  onClose,
  sheet = false,
  titleSize = "large",
  children,
}: CourtPageProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const header = (
    <PageHeader
      title={title}
      subtitle={subtitle}
      titleSize={sheet ? titleSize : "plain"}
      {...(closeLabel === undefined ? {} : { closeLabel })}
      {...(onClose === undefined ? {} : { onClose })}
    />
  );
  if (sheet) {
    return (
      <SheetSurface placement="page" accessibilityLabel={title}>
        {header}
        {children}
      </SheetSurface>
    );
  }
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
      {header}
      {children}
    </View>
  );
}
