import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import { LANDSCAPE_FLEX_WEIGHTS } from "../court.data";
import { sidesOf } from "../model/court-sides";
import type { LandscapeCourtLayout } from "../model/court-layout";
import type { CourtScreenModel } from "../model/court-screen.types";
import { dotColors, hintText, setsLabel } from "../model/screen-texts";
import type { CourtHandlers } from "./court-handlers";
import type { CourtExtras } from "./court-extras";
import { BottomStrip } from "./BottomStrip";
import { CourtHeader } from "./CourtHeader";
import { NetColumn } from "./NetColumn";
import { TeamZone } from "./TeamZone";

export interface CourtLandscapeProps extends CourtHandlers, CourtExtras {
  readonly model: CourtScreenModel;
  readonly layout: LandscapeCourtLayout;
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
  inverted = false,
  battery = null,
}: CourtLandscapeProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sides = sidesOf(inverted);
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
          panel={model.teams[sides.left]}
          end="left"
          layout={layout}
          onPoint={() => {
            onPoint(sides.left);
          }}
        />
        <NetColumn
          width={layout.netWidth}
          canUndo={model.canUndo}
          onUndo={onUndo}
          onCorrect={onCorrect}
        />
        <TeamZone
          panel={model.teams[sides.right]}
          end="right"
          layout={layout}
          onPoint={() => {
            onPoint(sides.right);
          }}
        />
      </View>
      <BottomStrip model={model} layout={layout} battery={battery} />
    </View>
  );
}
