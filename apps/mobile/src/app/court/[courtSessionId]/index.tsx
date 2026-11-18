import type { CourtSessionTimeline } from "@sacou/match-engine";
import { useIsFocused } from "expo-router";
import { useEffect, useMemo } from "react";
import { View } from "react-native";

import { asksOverTheCourt } from "../../../features/court/attribution/scored-point";
import { useCourtBatteryWarning } from "../../../features/court/hooks/battery-warning-context";
import { useCourtSides } from "../../../features/court/hooks/court-sides-context";
import { useBackGuard } from "../../../features/court/hooks/use-back-guard";
import { useAttributionSheet } from "../../../features/court/hooks/use-attribution-sheet";
import { useCourtGuard } from "../../../features/court/hooks/use-court-guard";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtScreenModel } from "../../../features/court/hooks/use-court-screen-model";
import { useIndividualPoints } from "../../../features/court/hooks/use-individual-points";
import { useUndoNotice } from "../../../features/court/hooks/use-undo-notice";
import { nextCourtRoute } from "../../../features/court/model/court-route-step";
import type { CourtPhase } from "../../../features/court/model/court-screen.types";
import { courtSidesInverted } from "../../../features/court/model/court-sides";
import { stateOfTimeline } from "../../../features/court/model/court-screen.selectors";
import { scorePointAndAsk } from "../../../features/court/session/score-point-flow";
import { undoCourtAction } from "../../../features/court/session/undo-court-action";
import { AttributionSheet } from "../../../features/court/ui/AttributionSheet";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { CourtScreen } from "../../../features/court/ui/CourtScreen";
import { BlockedCourtScreen } from "../../../features/court/ui/BlockedCourtScreen";
import { useServices } from "../../../services/services-context";

/** The sides as the log leaves them (the tie-break swaps once), or the manual choice with no log. */
function invertedOf(timeline: CourtSessionTimeline | null, manual: boolean): boolean {
  return timeline === null ? manual : courtSidesInverted(stateOfTimeline(timeline), manual);
}

/** The phases with no court: the end of the set or the result is in front. */
function isAwayFromCourt(phase: CourtPhase | null): boolean {
  return phase === "match-ended" || phase === "match-pending";
}

/** Screens 09 and 10. When the set is decided or the match ends, the court hands over to its route. */
export default function CourtRoute() {
  const route = useCourtRoute();
  const { courtRoster, courtFeedback } = useServices();
  const guard = useCourtGuard();
  const sides = useCourtSides();
  const warning = useCourtBatteryWarning();
  const { courtSessionId, view, dispatch, retry, markRefusedSeen, reload } = useCourtSession();
  const undoNotice = useUndoNotice();
  const { block, blockedScore, timeline, phase, model } = useCourtScreenModel(view, courtRoster);
  const individualPoints = useIndividualPoints();
  const attribution = useAttributionSheet(timeline, dispatch);

  // Navigation is an effect of the step the phase asks for, never of the data: it runs when the step
  // changes, so coming back from the end of the set (same step) does not open it again.
  const { push, replace } = route;
  const { open: openAttribution } = attribution;
  const sheet = attribution.model;
  const showSheet = useMemo(
    () => timeline !== null && sheet !== null && asksOverTheCourt(timeline, sheet.pointEventId),
    [timeline, sheet],
  );
  const focused = useIsFocused();
  // The back button of Android stays where it is while the court is in front (not on its menu);
  // leaving is by the Menu.
  useBackGuard(view.status === "ready" && guard.backBlocked(focused));
  const step = nextCourtRoute("court", phase, focused);
  useEffect(() => {
    if (step === "open-set-end") {
      push("setEnd");
    } else if (step === "open-match-end") {
      replace("matchEnd");
    }
  }, [step, push, replace]);
  // Back from the 09a, the file may hold the stream it imported: a blocked court reads it again.
  const blocked = block !== null;
  useEffect(() => {
    if (focused && blocked) reload();
  }, [focused, blocked, reload]);

  if (block !== null) {
    return (
      <BlockedCourtScreen
        block={block}
        courtSessionId={courtSessionId}
        localScore={blockedScore}
        onLeave={route.leave}
        onRefusedSeen={markRefusedSeen}
      />
    );
  }
  if (view.status === "loading" || (view.status === "ready" && isAwayFromCourt(phase))) {
    return null;
  }
  if (model === null) {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  return (
    <View style={{ flex: 1 }}>
      <CourtScreen
        model={model}
        inverted={invertedOf(timeline, sides.inverted)}
        battery={
          warning.state.status === "showing"
            ? { level: warning.state.level, onDismiss: warning.dismiss }
            : null
        }
        onPoint={(team) => {
          // The zones wait after a point, even if the engine turns this one down.
          if (guard.acceptPoint()) {
            void scorePointAndAsk(
              { dispatch, feedback: courtFeedback, individualPoints, openAttribution },
              team,
            );
          }
        }}
        notice={undoNotice.text}
        onUndo={() => {
          void undoCourtAction(timeline, {
            dispatch,
            teamLabel: (matchId, side) => courtRoster.teamAppearance(matchId, side).label,
            onUndone: (text) => {
              guard.acceptUndo();
              if (text !== null) {
                undoNotice.show(text);
              }
            },
          });
        }}
        onCorrect={() => {
          route.push("corrections");
        }}
        onOpenMenu={() => {
          route.push("menu");
        }}
      />
      {sheet === null || !showSheet ? null : (
        <AttributionSheet
          model={sheet}
          onChooseKind={attribution.onChooseKind}
          onAuthor={attribution.onAuthor}
          onOpponentError={attribution.onOpponentError}
          onSkip={attribution.onSkip}
        />
      )}
    </View>
  );
}
