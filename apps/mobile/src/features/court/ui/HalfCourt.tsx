import { View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES } from "../../../theme/team-colors";
import { ATTACK_LINE_RATIO, FLUSH } from "../court.data";
import { ratioToPercentText, type CourtEnd } from "../model/court-geometry";
import type { CourtLayout } from "../model/court-layout";
import type { TeamPanelModel } from "../model/court-screen.types";
import { layoutTeamChips, squareOrigin } from "../model/team-chips";
import { PlayerChip } from "./PlayerChip";

const DASH_PATTERN = "6 4";
const FULL = "100%";
const MIDDLE = "50%";

export interface HalfCourtProps {
  readonly panel: TeamPanelModel;
  readonly end: CourtEnd;
  readonly layout: CourtLayout;
}

export interface AttackLineProps {
  readonly color: string;
  readonly thickness: number;
  /** In landscape the line runs up and down, parallel to the net. */
  readonly vertical: boolean;
}

function AttackLine({ color, thickness, vertical }: AttackLineProps) {
  return (
    <Svg width={vertical ? thickness : FULL} height={vertical ? FULL : thickness}>
      <Line
        x1={vertical ? MIDDLE : "0"}
        x2={vertical ? MIDDLE : FULL}
        y1={vertical ? "0" : MIDDLE}
        y2={vertical ? FULL : MIDDLE}
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={DASH_PATTERN}
      />
    </Svg>
  );
}

/** The sides of the square that carry the team color: all but the one on the net. */
function frameWidths(end: CourtEnd, frame: number) {
  return {
    borderLeftWidth: end === "right" ? FLUSH : frame,
    borderRightWidth: end === "left" ? FLUSH : frame,
    borderTopWidth: end === "bottom" ? FLUSH : frame,
    borderBottomWidth: end === "top" ? FLUSH : frame,
  };
}

/** Where the attack line sits: a third of the square from the net, on the side of the net. */
function attackLinePlace(end: CourtEnd, offset: string) {
  switch (end) {
    case "top":
      return { left: FLUSH, right: FLUSH, bottom: offset };
    case "bottom":
      return { left: FLUSH, right: FLUSH, top: offset };
    case "left":
      return { top: FLUSH, bottom: FLUSH, right: offset };
    case "right":
      return { top: FLUSH, bottom: FLUSH, left: offset };
  }
}

/**
 * The square is anchored to the net with the style itself, not with a worked out pixel, so it
 * touches the net whatever the zone measures at the end; it grows from the net outwards.
 */
function squareAnchor(layout: CourtLayout, end: CourtEnd) {
  const origin = squareOrigin(layout, end);
  switch (end) {
    case "left":
      return { right: FLUSH, top: origin.y };
    case "right":
      return { left: FLUSH, top: origin.y };
    case "top":
      return { left: origin.x, bottom: FLUSH };
    case "bottom":
      return { left: origin.x, top: FLUSH };
  }
}

/**
 * The half court of one team with its edges in the team color, the attack line and its players. The
 * chips are not inside the bordered square but beside it, in the same box, so their pixels are the
 * ones the placement worked out.
 */
export function HalfCourt({ panel, end, layout }: HalfCourtProps) {
  const { tokens } = useTheme();
  const color = TEAM_PALETTES[panel.color].fill;
  const vertical = layout.kind === "landscape";
  const drawn = layoutTeamChips({ panel, layout, tokens, end });
  return (
    <View
      style={{
        position: "absolute",
        ...squareAnchor(layout, end),
        width: layout.halfCourtSide,
        aspectRatio: 1,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: FLUSH,
          bottom: FLUSH,
          left: FLUSH,
          right: FLUSH,
          borderColor: color,
          ...frameWidths(end, tokens.court.borderWidths.frame),
        }}
      >
        <View
          style={{
            position: "absolute",
            ...attackLinePlace(end, ratioToPercentText(ATTACK_LINE_RATIO)),
          }}
        >
          <AttackLine color={color} thickness={tokens.borderWidths.thick} vertical={vertical} />
        </View>
      </View>
      {drawn.map((item) => (
        <PlayerChip key={item.chip.memberId} drawn={item} />
      ))}
    </View>
  );
}
