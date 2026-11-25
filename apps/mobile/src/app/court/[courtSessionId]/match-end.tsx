import { useRoundClosed } from "../../../features/rounds/hooks/use-round-closed";
import type { TeamSide } from "@sacou/match-engine";
import { useEffect } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { finishedMatchCount } from "../../../features/court/model/menu-selectors";
import { endRoundView } from "../../../features/court/end-round/end-round-view";
import { useEndRound } from "../../../features/court/end-round/use-end-round";
import { useMatchEnd } from "../../../features/court/hooks/use-match-end";
import { nextCourtRoute } from "../../../features/court/model/court-route-step";
import {
  selectCourtPhase,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import {
  exitRows,
  nextWith,
  planExplanation,
  resultView,
} from "../../../features/court/next-match/match-end-selectors";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { MatchEndScreen } from "../../../features/court/ui/MatchEndScreen";
import { strings } from "../../../strings/pt-BR";
import { useServices } from "../../../services/services-context";

/** Screen 11: the result, the next match of the queue, and "Confirmar" starts it (D6, D7). */
export default function MatchEndRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
  const { view, dispatch, retry } = useCourtSession();
  const timeline = view.status === "ready" ? view.timeline : null;
  const onRoundClosed = useRoundClosed();
  const endRound = useEndRound(route.params.courtSessionId, onRoundClosed);
  const screen = useMatchEnd(route.params.courtSessionId, timeline, dispatch);
  const phase = timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline));
  const step = nextCourtRoute("match-end", phase, true);
  const { replace } = route;

  useEffect(() => {
    if (step === "open-court") replace("court");
  }, [step, replace]);

  if (view.status === "failed") {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  const { model, state } = screen;
  if (timeline === null || model.kind === "none" || state.status !== "ready") {
    return null;
  }
  const courtState = stateOfTimeline(timeline);
  const { match } = model;
  const team = (side: TeamSide) => courtRoster.teamAppearance(match.matchId, side);
  const next =
    model.kind === "refused"
      ? null
      : {
          teams: { a: team("a"), b: team("b") },
          with: nextWith(model.plan, courtRoster),
          explanation: planExplanation({
            state: courtState,
            match,
            plan: model.plan,
            criterion: screen.settings.queue.exitCriterion,
            fixedCount: screen.settings.queue.exitMode === "fixed-count",
            roster: courtRoster,
          }),
          rows: exitRows(match, model.plan, courtRoster),
          picks: model.picks,
          chosen: state.draft.chosen,
          canConfirm: model.canConfirm,
        };
  return (
    <MatchEndScreen
      result={resultView(courtState, match, courtRoster)}
      next={next}
      starting={state.starting}
      failure={
        state.failure ?? (screen.roundUnavailable ? strings.court.matchEnd.roundUnavailable : null)
      }
      onToggle={screen.toggle}
      onConfirm={screen.start}
      onLeave={route.leave}
      endRound={endRoundView(endRound.state)}
      onEndRound={() => {
        endRound.request({ openMatchScore: null, finishedMatches: finishedMatchCount(timeline) });
      }}
      onConfirmEndRound={endRound.confirm}
      onCancelEndRound={endRound.cancel}
    />
  );
}
