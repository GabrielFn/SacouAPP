import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme, ThemeProvider } from "../../../theme/theme-context";
import { sheetColors } from "../../../theme/sheet-tokens.data";
import { palette } from "../../../theme/tokens.data";
import { FLUSH } from "../court.data";

const HANDLE_WIDTH = "10%";
const BOTTOM_MAX_HEIGHT = "88%";
/** The 3 of the black top border of the point author sheet over the 2 of the other outlines. */
const TOP_BORDER_RATIO = 1.5;

export interface SheetSurfaceProps {
  /**
   * `bottom`: over the court, scrim behind and the sheet at the bottom (screen 31).
   * `page`: the route of the menu and of "Corrigir", the night ground and a sheet almost full height.
   */
  readonly placement: "bottom" | "page";
  /** The black line on the top edge of the sheet. */
  readonly inkTopBorder?: boolean;
  readonly accessibilityLabel?: string;
  readonly children: ReactNode;
}

/**
 * The chrome the three sheets of the court share (PontoIndividual, MenuQuadra, Corrigir): cream
 * ground, 24 radius on the top corners, grab handle, scrim and the safe area on the sides and at
 * the bottom. What is inside reads the light "app" theme in both court themes.
 */
export function SheetSurface({
  placement,
  inkTopBorder = false,
  accessibilityLabel,
  children,
}: SheetSurfaceProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = placement === "bottom";
  const sheetStyle = {
    backgroundColor: palette.sand,
    borderTopLeftRadius: tokens.radii.sheet,
    borderTopRightRadius: tokens.radii.sheet,
    ...(inkTopBorder
      ? {
          borderTopWidth: tokens.borderWidths.thick * TOP_BORDER_RATIO,
          borderTopColor: palette.black,
        }
      : null),
  };
  const content = (
    <View
      style={{
        flexGrow: bottom ? undefined : 1,
        flexShrink: 1,
        gap: tokens.spacing.m,
        paddingTop: tokens.spacing.s10,
        paddingLeft: insets.left + tokens.spacing.l,
        paddingRight: insets.right + tokens.spacing.l,
        paddingBottom: insets.bottom + tokens.spacing.m,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          alignSelf: "center",
          width: HANDLE_WIDTH,
          height: tokens.sizes.sheetHandle,
          borderRadius: tokens.sizes.sheetHandle,
          backgroundColor: sheetColors.handle,
        }}
      />
      {children}
    </View>
  );
  return (
    <ThemeProvider name="app">
      {bottom ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: FLUSH,
            right: FLUSH,
            bottom: FLUSH,
            left: FLUSH,
            justifyContent: "flex-end",
          }}
        >
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: sheetColors.scrim }]}
          />
          <View
            accessibilityLabel={accessibilityLabel}
            style={[sheetStyle, { maxHeight: BOTTOM_MAX_HEIGHT }]}
          >
            <ScrollView>{content}</ScrollView>
          </View>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: palette.night,
            paddingTop: Math.max(insets.top, tokens.spacing.s) + tokens.spacing.s,
          }}
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            style={[sheetStyle, { flex: 1 }]}
          >
            {content}
          </View>
        </View>
      )}
    </ThemeProvider>
  );
}

export interface SheetPanelProps {
  readonly children: ReactNode;
}

/**
 * The white panel of a question over a sheet (Corrigir.dc.html "Voltar o jogo para...?"): light ground,
 * a faint line on the top and 22 radius.
 */
export function SheetPanel({ children }: SheetPanelProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessibilityViewIsModal
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.card,
        padding: tokens.spacing.l,
        gap: tokens.spacing.s,
      }}
    >
      {children}
    </View>
  );
}
