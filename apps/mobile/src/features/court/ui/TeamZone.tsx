import { Pressable } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { COURT_FLEX_WEIGHTS } from "../court.data";
import type { CourtEnd } from "../model/court-geometry";
import type { CourtLayout } from "../model/court-layout";
import type { TeamPanelModel } from "../model/court-screen.types";
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
  const label = strings.court.zone.pointFor({
    team: panel.label,
    score: panel.score,
    setPoint: panel.hasSetPoint,
    serving: panel.isServing,
    serverName: panel.serverName,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPoint}
      style={{ flex: COURT_FLEX_WEIGHTS.zone, backgroundColor: colors.background }}
    >
      <TeamSideColumn panel={panel} end={end} layout={layout} />
      <HalfCourt panel={panel} end={end} side={layout.halfCourtSide} />
    </Pressable>
  );
}
