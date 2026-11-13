import type { TeamSide } from "@sacou/match-engine";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import type { TeamColorName } from "../../../theme/team-colors";
import { COURT_FLEX_WEIGHTS } from "../court.data";
import { computeCourtLayout } from "../model/court-layout";
import type { CourtScreenModel } from "../model/court-screen.types";
import { hintText, setsLabel, streakText } from "../model/screen-texts";
import { CenterStrip } from "./CenterStrip";
import { CourtHeader } from "./CourtHeader";
import { CourtLandscape } from "./CourtLandscape";
import { QueueStrip } from "./QueueStrip";
import { TeamZone } from "./TeamZone";

export interface CourtScreenProps {
  readonly model: CourtScreenModel;
  readonly onPoint: (team: TeamSide) => void;
  readonly onUndo: () => void;
  readonly onCorrect: () => void;
  readonly onOpenMenu: () => void;
}

function dotColors(model: CourtScreenModel): readonly (TeamColorName | null)[] {
  return model.dots.map(({ winner }) => (winner === null ? null : model.teams[winner].color));
}

/**
 * Screens 09 (sun) and 10 (night), drawn from the model and nothing else. The window decides the
 * layout: on its side it is the landscape court (the court locks the phone that way); upright is
 * the fallback for a tablet that ignores the lock, a split screen or a lock that failed.
 */
export function CourtScreen({ model, onPoint, onUndo, onCorrect, onOpenMenu }: CourtScreenProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = computeCourtLayout({
    windowWidth: width,
    windowHeight: height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    insetLeft: insets.left,
    insetRight: insets.right,
  });
  if (layout.kind === "landscape") {
    return (
      <CourtLandscape
        model={model}
        layout={layout}
        onPoint={onPoint}
        onUndo={onUndo}
        onCorrect={onCorrect}
        onOpenMenu={onOpenMenu}
      />
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <CourtHeader
        weight={COURT_FLEX_WEIGHTS.bar}
        setNumber={model.setNumber}
        sets={dotColors(model)}
        setsLabel={setsLabel(model)}
        onOpenMenu={onOpenMenu}
      />
      <TeamZone
        panel={model.teams.a}
        end="top"
        layout={layout}
        onPoint={() => {
          onPoint("a");
        }}
      />
      <CenterStrip
        hint={hintText(model)}
        canUndo={model.canUndo}
        onUndo={onUndo}
        onCorrect={onCorrect}
      />
      <TeamZone
        panel={model.teams.b}
        end="bottom"
        layout={layout}
        onPoint={() => {
          onPoint("b");
        }}
      />
      <QueueStrip queue={model.queue} streak={streakText(model)} layout={layout} />
    </View>
  );
}
