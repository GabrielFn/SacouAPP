import type { TeamSide } from "@sacou/match-engine";
import { useEffect, useMemo } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { nextCourtRoute } from "../../../features/court/model/court-route-step";
import {
  selectCourtPhase,
  selectSetEnd,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import { buildSetEndActions } from "../../../features/court/model/set-end-actions";
import { confirmSetEnd } from "../../../features/court/session/confirm-set-end";
import { CourtPlaceholder } from "../../../features/court/ui/CourtPlaceholder";
import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";

/** Placeholder of screen 25 (E4.10): confirms the end of the set, and takes the toss of the decider. */
export default function SetEndRoute() {
  const route = useCourtRoute();
  const { courtRoster, courtFeedback } = useServices();
  const { view, dispatch } = useCourtSession();
  const timeline = view.status === "ready" ? view.timeline : null;
  const model = useMemo(
    () => (timeline === null ? null : selectSetEnd(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const phase = timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline));
  const { backOrCourt, replace } = route;
  const step = nextCourtRoute("set-end", phase, true);

  // Confirming the set starts the next one (back to the court) or, for the deciding set, ends the
  // match: the same confirmation stores both events, so this screen hands over to the result.
  useEffect(() => {
    if (step === "go-back") {
      backOrCourt();
    } else if (step === "open-match-end") {
      replace("matchEnd");
    }
  }, [step, backOrCourt, replace]);

  if (model === null) {
    return null;
  }
  const { setEnd } = strings.court;
  const confirm = (firstServer?: TeamSide) => {
    void confirmSetEnd({ dispatch, feedback: courtFeedback }, firstServer);
  };
  const confirmActions = buildSetEndActions(model, setEnd, confirm);
  return (
    <CourtPlaceholder
      title={setEnd.title(model.setNumber)}
      lines={[
        setEnd.winner(model.winnerLabel),
        setEnd.scoreLine(
          model.scores.a.label,
          model.scores.a.score,
          model.scores.b.label,
          model.scores.b.score,
        ),
        ...(model.needsFirstServer ? [setEnd.whoServes] : []),
      ]}
      actions={[
        ...confirmActions,
        { label: setEnd.back, variant: "secondary", onPress: backOrCourt },
      ]}
    />
  );
}
