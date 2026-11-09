import { Pressable } from "react-native";

import { useTheme } from "../../../theme/theme-context";
import { COURT_FLEX_WEIGHTS } from "../court.data";
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

/** The team zone is one big button: a tap anywhere in it is a point for this team. */
export function TeamZone({ panel, end, layout, onPoint }: TeamZoneProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={zoneLabel(panel)}
      onPress={onPoint}
      style={{ flex: COURT_FLEX_WEIGHTS.zone, backgroundColor: colors.background }}
    >
      <TeamSideColumn panel={panel} end={end} layout={layout} />
      <HalfCourt panel={panel} end={end} side={layout.halfCourtSide} />
    </Pressable>
  );
}
