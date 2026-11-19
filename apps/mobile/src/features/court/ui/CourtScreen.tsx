import { useState } from "react";
import { useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../../theme/theme-context";
import { COURT_FLEX_WEIGHTS } from "../court.data";
import { sidesOf } from "../model/court-sides";
import { computeCourtLayout } from "../model/court-layout";
import type { CourtScreenModel } from "../model/court-screen.types";
import { dotColors, hintText, setsLabel } from "../model/screen-texts";
import { BottomStrip } from "./BottomStrip";
import { CenterStrip } from "./CenterStrip";
import type { CourtHandlers } from "./court-handlers";
import type { CourtExtras } from "./court-extras";
import { CourtHeader } from "./CourtHeader";
import { CourtLandscape } from "./CourtLandscape";
import { TeamZone } from "./TeamZone";

export interface CourtScreenProps extends CourtHandlers, CourtExtras {
  readonly model: CourtScreenModel;
}

/**
 * Screens 09 (sun) and 10 (night), drawn from the model and nothing else. The window decides the
 * layout: on its side it is the landscape court (the court locks the phone that way); upright is
 * the fallback for a tablet that ignores the lock, a split screen or a lock that failed.
 */
export function CourtScreen(props: CourtScreenProps) {
  const window = useWindowDimensions();
  // The area the screen really got, once measured. On Android the window can be taller than the
  // view (system bars the insets do not report), and a layout worked out from the window would push
  // the half courts under the queue (phone test of 18/11/2026).
  const [area, setArea] = useState<CourtArea | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea((current) =>
      current !== null && current.width === width && current.height === height
        ? current
        : { width, height },
    );
  };
  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <CourtScreenContent {...props} area={area ?? window} />
    </View>
  );
}

interface CourtArea {
  readonly width: number;
  readonly height: number;
}

function CourtScreenContent({
  area,
  model,
  onPoint,
  onUndo,
  onCorrect,
  onOpenMenu,
  inverted = false,
  battery = null,
  notice = null,
}: CourtScreenProps & { readonly area: CourtArea }) {
  const { colors } = useTheme();
  const { width, height } = area;
  const insets = useSafeAreaInsets();
  const sides = sidesOf(inverted);
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
        inverted={inverted}
        battery={battery}
        notice={notice}
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
        setsLabel={setsLabel(model, inverted)}
        onOpenMenu={onOpenMenu}
      />
      <TeamZone
        panel={model.teams[sides.left]}
        end="top"
        layout={layout}
        onPoint={() => {
          onPoint(sides.left);
        }}
      />
      <CenterStrip
        hint={notice ?? hintText(model)}
        canUndo={model.canUndo}
        onUndo={onUndo}
        onCorrect={onCorrect}
      />
      <TeamZone
        panel={model.teams[sides.right]}
        end="bottom"
        layout={layout}
        onPoint={() => {
          onPoint(sides.right);
        }}
      />
      <BottomStrip model={model} layout={layout} battery={battery} />
    </View>
  );
}
