import { View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES } from "../../../theme/team-colors";
import { ATTACK_LINE_RATIO, COURT_ZONE_RATIOS, FLUSH } from "../court.data";
import { placeOnHalfCourt, ratioToPercentText, type CourtEnd } from "../model/court-geometry";
import type { TeamPanelModel } from "../model/court-screen.types";
import { PlayerChip } from "./PlayerChip";

const DASH_PATTERN = "6 4";
const FULL = "100%";
const MIDDLE = "50%";

export interface HalfCourtProps {
  readonly panel: TeamPanelModel;
  readonly end: CourtEnd;
  /** The side of the square, in pixels, from the window (see `computeCourtLayout`). */
  readonly side: number;
}

export interface AttackLineProps {
  readonly color: string;
  readonly thickness: number;
}

function AttackLine({ color, thickness }: AttackLineProps) {
  return (
    <Svg width={FULL} height={thickness}>
      <Line
        x1="0"
        x2={FULL}
        y1={MIDDLE}
        y2={MIDDLE}
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={DASH_PATTERN}
      />
    </Svg>
  );
}

/** The half court of one team with its edges in the team color, the attack line and its players. */
export function HalfCourt({ panel, end, side }: HalfCourtProps) {
  const { tokens } = useTheme();
  const color = TEAM_PALETTES[panel.color].fill;
  const frame = tokens.court.borderWidths.frame;
  const isTop = end === "top";
  const attackOffset = ratioToPercentText(ATTACK_LINE_RATIO);
  const edgeOffset = ratioToPercentText(COURT_ZONE_RATIOS.edge);
  return (
    <View
      style={{
        position: "absolute",
        right: edgeOffset,
        top: isTop ? undefined : FLUSH,
        bottom: isTop ? FLUSH : undefined,
        width: side,
        aspectRatio: 1,
        borderColor: color,
        borderLeftWidth: frame,
        borderRightWidth: frame,
        borderTopWidth: isTop ? frame : FLUSH,
        borderBottomWidth: isTop ? FLUSH : frame,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: FLUSH,
          right: FLUSH,
          top: isTop ? undefined : attackOffset,
          bottom: isTop ? attackOffset : undefined,
        }}
      >
        <AttackLine color={color} thickness={tokens.borderWidths.thick} />
      </View>
      {panel.chips.map((chip) => (
        <PlayerChip key={chip.memberId} chip={chip} place={placeOnHalfCourt(chip.point, end)} />
      ))}
    </View>
  );
}
