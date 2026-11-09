import type { ReactNode } from "react";
import { View, type TextStyle } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { Text } from "../../../ui/Text";
import { COURT_ZONE_RATIOS, FLUSH } from "../court.data";
import { ratioToPercentText, type CourtEnd } from "../model/court-geometry";
import type { CourtLayout } from "../model/court-layout";
import type { TeamPanelModel } from "../model/court-screen.types";
import { ScoreNumber } from "./ScoreNumber";
import { SetPointTag } from "./SetPointTag";
import { TeamTag } from "./TeamTag";

export interface TeamSideColumnProps {
  readonly panel: TeamPanelModel;
  readonly end: CourtEnd;
  readonly layout: CourtLayout;
}

/** A line of the column and the gap that separates it from the line before it, read top-down. */
interface SideLine {
  readonly key: string;
  readonly node: ReactNode;
  readonly gapBefore: number;
}

function rotationText(panel: TeamPanelModel): string | null {
  const { rotation } = panel;
  if (rotation === null) {
    return null;
  }
  return rotation.system === "livre"
    ? strings.court.zone.freeSystem
    : strings.court.zone.rotation(rotation.system, rotation.setterZone);
}

/** Tag, score, then the set point tag or the phase, then the rotation: the team on top reads top-down. */
function useSideLines({ panel, layout }: TeamSideColumnProps): readonly SideLine[] {
  const { colors, tokens } = useTheme();
  const { spacing } = tokens;
  const phaseStyle: TextStyle = { color: colors.textMuted, fontSize: tokens.fontSizes.caption };
  const rotation = rotationText(panel);
  const indicator: SideLine = panel.hasSetPoint
    ? { key: "set-point", node: <SetPointTag />, gapBefore: spacing.xs }
    : {
        key: "phase",
        node: (
          <Text style={{ ...phaseStyle, fontFamily: fontFamilies.body700 }}>
            {panel.isServing ? strings.court.zone.serving : strings.court.zone.receiving}
          </Text>
        ),
        gapBefore: spacing.s6,
      };
  const lines: readonly SideLine[] = [
    {
      key: "tag",
      node: (
        <TeamTag
          color={panel.color}
          letter={strings.court.zone.teamLetter[panel.side]}
          label={panel.label}
        />
      ),
      gapBefore: FLUSH,
    },
    {
      key: "score",
      node: (
        <ScoreNumber
          score={panel.score}
          zoneHeight={layout.zoneHeight}
          sideWidth={layout.sideWidth}
          color={panel.hasSetPoint ? colors.scoreHighlight : colors.text}
        />
      ),
      gapBefore: tokens.court.spacing.scoreGap,
    },
    indicator,
  ];
  return rotation === null
    ? lines
    : [
        ...lines,
        {
          key: "rotation",
          node: <Text style={{ ...phaseStyle, fontFamily: fontFamilies.body600 }}>{rotation}</Text>,
          gapBefore: panel.hasSetPoint ? spacing.xs : FLUSH,
        },
      ];
}

/** The team on the bottom reads the other way round, so the gaps move to the other side of each line. */
export function TeamSideColumn(props: TeamSideColumnProps) {
  const { tokens } = useTheme();
  const isTop = props.end === "top";
  const lines = useSideLines(props);
  const ordered = isTop ? lines : [...lines].reverse();
  return (
    <View
      style={{
        position: "absolute",
        left: ratioToPercentText(COURT_ZONE_RATIOS.edge),
        width: ratioToPercentText(COURT_ZONE_RATIOS.side),
        top: isTop ? tokens.spacing.s14 : undefined,
        bottom: isTop ? undefined : tokens.spacing.s14,
        alignItems: "flex-start",
      }}
    >
      {ordered.map(({ key, node, gapBefore }) => (
        <View key={key} style={isTop ? { marginTop: gapBefore } : { marginBottom: gapBefore }}>
          {node}
        </View>
      ))}
    </View>
  );
}
