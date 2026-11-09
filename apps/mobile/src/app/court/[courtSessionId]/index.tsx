import { useEffect, useMemo } from "react";

import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import {
  selectCourtPhase,
  selectCourtScreen,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { CourtScreen } from "../../../features/court/ui/CourtScreen";
import { useServices } from "../../../services/services-context";

/** Screens 09 and 10. When the set is decided or the match ends, the court hands over to its route. */
export default function CourtRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
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

  // Navigation is an effect of the phase, never of the data: it runs when the phase changes, so
  // coming back from the end of the set (same phase) does not open it again.
  const { push, replace } = route;
  useEffect(() => {
    if (phase === "set-decided") {
      push("setEnd");
    } else if (phase === "match-ended") {
      replace("matchEnd");
    }
  }, [phase, push, replace]);

  if (view.status === "loading" || (view.status === "ready" && phase === "match-ended")) {
    return null;
  }
  if (model === null) {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  return (
    <CourtScreen
      model={model}
      onPoint={(team) => {
        void dispatch({ type: "score-point", team });
      }}
      onUndo={() => {
        void dispatch({ type: "undo" });
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
