import { useRef } from "react";
import { Pressable } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { COURT_FLEX_WEIGHTS, LANDSCAPE_WIDTH_WEIGHTS } from "../court.data";
import { isPalmTouch, nextPeakTouches } from "../guard/palm";
import type { CourtEnd } from "../model/court-geometry";
import type { CourtLayout } from "../model/court-layout";
import type { TeamPanelModel } from "../model/court-screen.types";
import { zoneLabel } from "../model/zone-label";
import { HalfCourt } from "./HalfCourt";
import { TeamSideColumn } from "./TeamSideColumn";

export interface TeamZoneProps {
  readonly panel: TeamPanelModel;
  readonly end: CourtEnd;
  readonly layout: CourtLayout;
  readonly onPoint: () => void;
}

/**
 * The team zone is one big button: a tap anywhere in it is a point for this team. A touch with two
 * fingers or more is a palm on the screen and is not a point.
 */
export function TeamZone({ panel, end, layout, onPoint }: TeamZoneProps) {
  const { colors } = useTheme();
  const peakTouches = useRef(0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={zoneLabel(panel)}
      onTouchStart={(event) => {
        peakTouches.current = nextPeakTouches(
          peakTouches.current,
          event.nativeEvent.touches.length,
        );
      }}
      onPress={() => {
        if (!isPalmTouch(peakTouches.current)) {
          onPoint();
        }
      }}
      style={{
        flex: layout.kind === "landscape" ? LANDSCAPE_WIDTH_WEIGHTS.zone : COURT_FLEX_WEIGHTS.zone,
        backgroundColor: colors.background,
      }}
    >
      <TeamSideColumn panel={panel} end={end} layout={layout} />
      <HalfCourt panel={panel} end={end} layout={layout} />
    </Pressable>
  );
}
