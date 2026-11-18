import { useIsFocused } from "expo-router";
import { useEffect } from "react";

import { useCourtBatteryWarning } from "../../../features/court/hooks/battery-warning-context";
import { useCourtSides } from "../../../features/court/hooks/court-sides-context";
import { useBackGuard } from "../../../features/court/hooks/use-back-guard";
import { useCourtGuard } from "../../../features/court/hooks/use-court-guard";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtScreenModel } from "../../../features/court/hooks/use-court-screen-model";
import { useUndoNotice } from "../../../features/court/hooks/use-undo-notice";
import { nextCourtRoute } from "../../../features/court/model/court-route-step";
import { undoCourtAction } from "../../../features/court/session/undo-court-action";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { CourtScreen } from "../../../features/court/ui/CourtScreen";
import { TakenOverView } from "../../../features/court/ui/TakenOverView";
import { useServices } from "../../../services/services-context";

/** Screens 09 and 10. When the set is decided or the match ends, the court hands over to its route. */
export default function CourtRoute() {
  const route = useCourtRoute();
  const { courtRoster, courtFeedback } = useServices();
  const guard = useCourtGuard();
  const { inverted } = useCourtSides();
  const warning = useCourtBatteryWarning();
  const { view, dispatch, retry } = useCourtSession();
  const undoNotice = useUndoNotice();
  const { takenOver, timeline, phase, model } = useCourtScreenModel(view, courtRoster);

  // Navigation is an effect of the step the phase asks for, never of the data: it runs when the step
  // changes, so coming back from the end of the set (same step) does not open it again.
  const { push, replace } = route;
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

  if (takenOver) {
    return <TakenOverView onLeave={route.leave} />;
  }
  if (view.status === "loading" || (view.status === "ready" && phase === "match-ended")) {
    return null;
  }
  if (model === null) {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  return (
    <CourtScreen
      model={model}
      inverted={inverted}
      battery={
        warning.state.status === "showing"
          ? { level: warning.state.level, onDismiss: warning.dismiss }
          : null
      }
      onPoint={(team) => {
        // The zones wait after a point, even if the engine turns this one down.
        if (guard.acceptPoint()) {
          void dispatch({ type: "score-point", team }).then((result) => {
            if (!result.ok) {
              courtFeedback.play("refused");
            }
          });
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
  );
}
