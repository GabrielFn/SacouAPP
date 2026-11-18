import { useMemo } from "react";

import { useCourtSides } from "../../../features/court/hooks/court-sides-context";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtTheme } from "../../../features/court/hooks/use-court-theme";
import { endMatchSummary, menuSubtitle } from "../../../features/court/model/menu-selectors";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { MatchMenuSheet } from "../../../features/court/ui/MatchMenuSheet";
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
  const timeline = view.status === "ready" ? view.timeline : null;
  const subtitle = useMemo(
    () => (timeline === null ? null : menuSubtitle(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const summary = useMemo(
    () => (timeline === null ? null : endMatchSummary(timeline, courtRoster)),
    [timeline, courtRoster],
  );
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
      }
    });
  };
  return (
    <MatchMenuSheet
      subtitle={subtitle}
      inverted={inverted}
      theme={theme.choice}
      endSummary={summary}
      onClose={route.back}
      onCorrections={() => {
        route.push("corrections");
      }}
      onFlipSides={() => {
        toggle();
        route.back();
      }}
      onChooseTheme={theme.choose}
      onLeave={route.leave}
      onEndMatch={endMatch}
    />
  );
}
