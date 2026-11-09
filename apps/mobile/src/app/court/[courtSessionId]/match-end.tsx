import { useMemo } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { selectMatchEnd } from "../../../features/court/model/court-screen.selectors";
import { CourtPlaceholder } from "../../../features/court/ui/CourtPlaceholder";
import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";

/** Placeholder of screen 11 and of the next match (E4.10). */
export default function MatchEndRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
  const { view } = useCourtSession();
  const timeline = view.status === "ready" ? view.timeline : null;
  const model = useMemo(
    () => (timeline === null ? null : selectMatchEnd(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  if (model === null) {
    return null;
  }
  const { matchEnd } = strings.court;
  return (
    <CourtPlaceholder
      title={matchEnd.title}
      lines={[
        model.winnerLabel === null ? matchEnd.noWinner : matchEnd.winner(model.winnerLabel),
        ...model.sets.map(({ setNumber, a, b }) => matchEnd.setScore(setNumber, a, b)),
      ]}
      actions={[{ label: matchEnd.home, onPress: route.leave }]}
    />
  );
}
