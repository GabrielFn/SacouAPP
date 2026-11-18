import type { TeamSide } from "@sacou/match-engine";
import { useEffect, useMemo, useState } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { nextCourtRoute } from "../../../features/court/model/court-route-step";
import {
  selectCourtPhase,
  selectSetEnd,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import { refusalText } from "../../../features/court/model/refusal-text";
import {
  canConfirmSetEnd,
  firstServerToSend,
  setEndView,
} from "../../../features/court/model/set-end-view";
import { confirmSetEnd } from "../../../features/court/session/confirm-set-end";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { SetEndSheet } from "../../../features/court/ui/SetEndSheet";
import { useServices } from "../../../services/services-context";

/** Screen 25: confirms the end of the set, with the toss of the deciding set (D5). */
export default function SetEndRoute() {
  const route = useCourtRoute();
  const { courtRoster, courtFeedback, coinFlip } = useServices();
  const { view, dispatch, retry } = useCourtSession();
  // The toss is not recorded until the confirmation: leaving the screen forgets it.
  const [toss, setToss] = useState<TeamSide | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const timeline = view.status === "ready" ? view.timeline : null;
  const model = useMemo(
    () => (timeline === null ? null : selectSetEnd(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const phase = timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline));
  const { backOrCourt, replace } = route;
  const step = nextCourtRoute("set-end", phase, true);

  // Undoing the last point goes back to the court; confirming the next set too, and confirming the
  // deciding set hands over to the result (the confirmation stores `SetEnded` and `MatchEnded`).
  useEffect(() => {
    if (step === "go-back") {
      backOrCourt();
    } else if (step === "open-match-end") {
      replace("matchEnd");
    }
  }, [step, backOrCourt, replace]);

  if (view.status === "failed") {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  if (model === null || timeline === null) {
    return null;
  }
  const matchId = stateOfTimeline(timeline).currentMatch?.matchId ?? "";
  const colorOf = (side: TeamSide) => courtRoster.teamAppearance(matchId, side).color;
  return (
    <SetEndSheet
      model={model}
      view={setEndView(model)}
      colors={{ a: colorOf("a"), b: colorOf("b") }}
      toss={toss}
      canConfirm={canConfirmSetEnd(model, toss)}
      refusal={refusal}
      onChooseToss={setToss}
      onDrawToss={() => {
        setToss(coinFlip.flip());
      }}
      onUndo={() => {
        void dispatch({ type: "undo" }).then((result) => {
          setRefusal(result.ok ? null : refusalText(result.error));
        });
      }}
      onConfirm={() => {
        const sent = confirmSetEnd(
          { dispatch, feedback: courtFeedback },
          firstServerToSend(model, toss),
        );
        void sent.then((result) => {
          setRefusal(result.ok ? null : refusalText(result.error));
        });
      }}
    />
  );
}
