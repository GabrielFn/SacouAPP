import { useRoundClosed } from "../../../features/rounds/hooks/use-round-closed";
import { useMemo, useState } from "react";

import { useCourtSides } from "../../../features/court/hooks/court-sides-context";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtTheme } from "../../../features/court/hooks/use-court-theme";
import { endRoundView } from "../../../features/court/end-round/end-round-view";
import { useEndRound } from "../../../features/court/end-round/use-end-round";
import {
  endMatchSummary,
  menuSubtitle,
  openMatchScore,
} from "../../../features/court/model/menu-selectors";
import { refusalText } from "../../../features/court/model/refusal-text";
import { canSubstitute } from "../../../features/court/substitution/substitution-selectors";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { MatchMenuSheet } from "../../../features/court/ui/MatchMenuSheet";
import { hasLineupToEdit } from "../../../features/lineup/model/match-lineup-source";
import { useServices } from "../../../services/services-context";

/**
 * Screen 23. "Inverter lados" closes the menu (Gabriel, questions 50 and 51). "Encerrar partida"
 * writes the end of the match and hands over to the result; with the set decided it goes to the
 * confirmation of the set instead.
 */
export default function MenuRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
  const { inverted, toggle } = useCourtSides();
  const theme = useCourtTheme();
  const { view, dispatch, retry } = useCourtSession();
  const [refusal, setRefusal] = useState<string | null>(null);
  const onRoundClosed = useRoundClosed();
  const endRound = useEndRound(route.params.courtSessionId, onRoundClosed);
  const timeline = view.status === "ready" ? view.timeline : null;
  const subtitle = useMemo(
    () => (timeline === null ? null : menuSubtitle(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const summary = useMemo(
    () => (timeline === null ? null : endMatchSummary(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const substitutable = useMemo(() => timeline !== null && canSubstitute(timeline), [timeline]);
  if (view.status === "failed") {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  if (view.status === "loading") {
    return null;
  }
  const endMatch = () => {
    if (summary?.kind === "confirm-set") {
      route.replace("setEnd");
      return;
    }
    void dispatch({ type: "end-match-manually" }).then((result) => {
      if (result.ok) {
        route.replace("matchEnd");
      } else {
        setRefusal(refusalText(result.error));
      }
    });
  };
  return (
    <MatchMenuSheet
      subtitle={subtitle}
      inverted={inverted}
      theme={theme.choice}
      endSummary={summary}
      canSubstitute={substitutable}
      refusal={refusal}
      onClose={route.back}
      onLineup={
        timeline !== null && hasLineupToEdit(timeline)
          ? () => {
              route.push("lineup");
            }
          : null
      }
      onCorrections={() => {
        route.push("corrections");
      }}
      onSubstitution={() => {
        route.push("substitution");
      }}
      onFlipSides={() => {
        toggle();
        route.back();
      }}
      onChooseTheme={theme.choose}
      onLeave={route.leave}
      onEndMatch={endMatch}
      endRound={{
        view: endRoundView(endRound.state),
        onAsk: () => {
          endRound.request(timeline === null ? null : openMatchScore(timeline));
        },
        onConfirm: endRound.confirm,
        onCancel: endRound.cancel,
      }}
    />
  );
}
