import type { TeamSide } from "@sacou/match-engine";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import type { TeamColorName } from "../../../theme/team-colors";
import { LANDSCAPE_FLEX_WEIGHTS } from "../court.data";
import type { LandscapeCourtLayout } from "../model/court-layout";
import type { CourtScreenModel } from "../model/court-screen.types";
import { hintText, setsLabel, streakText } from "../model/screen-texts";
import { CourtHeader } from "./CourtHeader";
import { NetColumn } from "./NetColumn";
import { QueueStrip } from "./QueueStrip";
import { TeamZone } from "./TeamZone";

export interface CourtLandscapeProps {
  readonly model: CourtScreenModel;
  readonly layout: LandscapeCourtLayout;
  readonly onPoint: (team: TeamSide) => void;
  readonly onUndo: () => void;
  readonly onCorrect: () => void;
  readonly onOpenMenu: () => void;
}

function dotColors(model: CourtScreenModel): readonly (TeamColorName | null)[] {
  return model.dots.map(({ winner }) => (winner === null ? null : model.teams[winner].color));
}

/**
 * The court on its side (the sketch approved for E4.17): the bar with the hint in its middle, team
 * A on the left, the net with DESFAZER and Corrigir, team B on the right, and the queue in one row.
 */
export function CourtLandscape({
  model,
  layout,
  onPoint,
  onUndo,
  onCorrect,
  onOpenMenu,
}: CourtLandscapeProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <CourtHeader
        weight={LANDSCAPE_FLEX_WEIGHTS.bar}
        setNumber={model.setNumber}
        sets={dotColors(model)}
        setsLabel={setsLabel(model)}
        hint={hintText(model)}
        onOpenMenu={onOpenMenu}
      />
      <View style={{ flex: LANDSCAPE_FLEX_WEIGHTS.middle, flexDirection: "row" }}>
        <TeamZone
          panel={model.teams.a}
          end="left"
          layout={layout}
          onPoint={() => {
            onPoint("a");
          }}
        />
        <NetColumn canUndo={model.canUndo} onUndo={onUndo} onCorrect={onCorrect} />
        <TeamZone
          panel={model.teams.b}
          end="right"
          layout={layout}
          onPoint={() => {
            onPoint("b");
          }}
        />
      </View>
      <QueueStrip queue={model.queue} streak={streakText(model)} layout={layout} />
    </View>
  );
}
