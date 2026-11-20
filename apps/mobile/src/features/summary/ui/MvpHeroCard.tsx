import { StyleSheet, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";

const { summary } = strings;

const COURT_VIEW_BOX = "0 0 358 178";
const STAR_VIEW_BOX = "0 0 24 24";
const STAR_PATH = "M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21.1l1.6-7L2 9.3l7.1-.7z";
const COURT_LINE_OPACITY = 0.12;
const NOTE_OPACITY = 0.75;
const LINE_OPACITY = 0.85;
const COURT_STROKE = 2;
const NET_STROKE = 3;

export interface MvpHeroCardProps {
  /** Already assembled: "Bia", and "Bia e Gabi" for a pair of the sand (E4.18). */
  readonly name: string;
  /** "Laranja · +2 de saldo · 2 vitórias em 3". */
  readonly line: string;
  /** Shows "Calculado pelo placar". */
  readonly byStats: boolean;
}

/** The dark card of the MVP of the day (Resumo.dc.html): grows with the name, never a fixed height. */
export function MvpHeroCard({ name, line, byStats }: MvpHeroCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${summary.mvpAccessibility(name)}. ${line}`}
      style={{
        backgroundColor: colors.panelSurface,
        borderRadius: tokens.radii.pill,
        paddingVertical: tokens.spacing.l,
        paddingHorizontal: tokens.spacing.xl,
        overflow: "hidden",
        gap: tokens.spacing.xs,
      }}
    >
      <Svg
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        viewBox={COURT_VIEW_BOX}
        preserveAspectRatio="xMaxYMid slice"
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        fill="none"
        stroke={colors.onPanel}
        strokeOpacity={COURT_LINE_OPACITY}
        strokeWidth={COURT_STROKE}
      >
        <Path d="M200 14h140v200h-140z" />
        <Line x1={200} y1={84} x2={340} y2={84} strokeWidth={NET_STROKE} />
        <Line x1={200} y1={56} x2={340} y2={56} />
        <Line x1={200} y1={112} x2={340} y2={112} />
      </Svg>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s6 }}>
        <Svg
          width={tokens.sizes.checkIcon}
          height={tokens.sizes.checkIcon}
          viewBox={STAR_VIEW_BOX}
          fill={colors.panelAccent}
        >
          <Path d={STAR_PATH} />
        </Svg>
        <Text variant="bodyStrong" style={{ color: colors.panelAccent }}>
          {summary.mvpTitle}
        </Text>
      </View>
      <Text
        variant="display"
        displaySize="displayMvp"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: colors.onPanel }}
      >
        {name}
      </Text>
      <Text variant="muted" style={{ color: colors.onPanel, opacity: LINE_OPACITY }}>
        {line}
      </Text>
      {byStats ? (
        <Text variant="caption" style={{ color: colors.onPanel, opacity: NOTE_OPACITY }}>
          {summary.mvpNote}
        </Text>
      ) : null}
    </View>
  );
}
