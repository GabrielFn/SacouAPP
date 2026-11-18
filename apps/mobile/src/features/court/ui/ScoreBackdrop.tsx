import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES, type TeamPalette } from "../../../theme/team-colors";
import { Text } from "../../../ui/Text";
import type { BackdropScore } from "../takeover/takeover-texts";

/** How much the scrim hides the score: dark under a dialog, light under the 09b banner. */
export type BackdropScrim = "dark" | "light";

const SCRIM_OPACITY: Readonly<Record<BackdropScrim, number>> = { dark: 0.55, light: 0.35 };

export interface ScoreBackdropProps {
  /** `null` without a score to show: the halves are plain. */
  readonly score: BackdropScore | null;
  readonly scrim: BackdropScrim;
  readonly children: ReactNode;
}

export interface HalfProps {
  readonly look: TeamPalette;
  readonly points: number | null;
}

function Half({ look, points }: HalfProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: look.fill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {points === null ? null : (
        <Text variant="display" displaySize="displayScore" tabular style={{ color: look.onFill }}>
          {String(points)}
        </Text>
      )}
    </View>
  );
}

/**
 * The score behind screens 09a to 09c (AssumirQuadra.dc.html and siblings): orange over blue, hidden
 * from the screen reader (the dialog says the score), under a scrim; the content goes over it.
 */
export function ScoreBackdrop({ score, scrim, children }: ScoreBackdropProps) {
  const { colors } = useTheme();
  const scrimColor = scrim === "dark" ? colors.panelSurface : colors.background;
  return (
    <View style={{ flex: 1 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <Half look={TEAM_PALETTES.orange} points={score?.a ?? null} />
        <Half look={TEAM_PALETTES.blue} points={score?.b ?? null} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: scrimColor, opacity: SCRIM_OPACITY[scrim] },
          ]}
        />
      </View>
      {children}
    </View>
  );
}
