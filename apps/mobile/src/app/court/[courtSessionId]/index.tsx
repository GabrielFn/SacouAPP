import { useIsFocused } from "expo-router";
import { useEffect, useMemo } from "react";

import { useBackGuard } from "../../../features/court/hooks/use-back-guard";
import { useCourtGuard } from "../../../features/court/hooks/use-court-guard";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { nextCourtRoute } from "../../../features/court/model/court-route-step";
import {
  selectCourtPhase,
  selectCourtScreen,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import { selectLastPoint } from "../../../features/court/model/point-toast";
import { pointToastText } from "../../../features/court/model/screen-texts";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { CourtScreen } from "../../../features/court/ui/CourtScreen";
import { useServices } from "../../../services/services-context";

/** Screens 09 and 10. When the set is decided or the match ends, the court hands over to its route. */
export default function CourtRoute() {
  const route = useCourtRoute();
  const { courtRoster, courtFeedback } = useServices();
  const guard = useCourtGuard();
  const { view, dispatch, retry } = useCourtSession();
  const timeline = view.status === "ready" ? view.timeline : null;
  const phase = useMemo(
    () => (timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline))),
    [timeline],
  );
  const model = useMemo(
    () => (timeline === null ? null : selectCourtScreen(timeline, courtRoster)),
    [timeline, courtRoster],
  );

  // Navigation is an effect of the step the phase asks for, never of the data: it runs when the step
  // changes, so coming back from the end of the set (same step) does not open it again.
  const { push, replace } = route;
  const focused = useIsFocused();
  // While locked, the back button of Android stays where it is (only on the court, not on its menu).
  useBackGuard(view.status === "ready" && guard.backBlocked(focused));
  const step = nextCourtRoute("court", phase, focused);
  useEffect(() => {
    if (step === "open-set-end") {
      push("setEnd");
    } else if (step === "open-match-end") {
      replace("matchEnd");
    }
  }, [step, push, replace]);

  const lastPoint = useMemo(
    () => (timeline === null ? null : selectLastPoint(timeline)),
    [timeline],
  );
  const toast =
    guard.toastVisible && model !== null && lastPoint !== null
      ? pointToastText(model, lastPoint)
      : null;

  if (view.status === "loading" || (view.status === "ready" && phase === "match-ended")) {
    return null;
  }
  if (model === null) {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  return (
    <CourtScreen
      model={model}
      toast={toast}
      locked={guard.locked}
      onPoint={(team) => {
        // The zones wait after a point, even if the engine turns this one down.
        if (guard.acceptPoint()) {
          void dispatch({ type: "score-point", team }).then((result) => {
            if (result.ok) {
              guard.recordPoint();
            } else {
              courtFeedback.play("refused");
            }
          });
        }
      }}
      onUndo={() => {
        void dispatch({ type: "undo" }).then((result) => {
          if (result.ok) {
            guard.acceptUndo();
          } else {
            courtFeedback.play("refused");
          }
        });
      }}
      onUnlock={guard.unlock}
      onLock={guard.lock}
      onCorrect={() => {
        route.push("corrections");
      }}
      onOpenMenu={() => {
        route.push("menu");
      }}
    />
  );
}
