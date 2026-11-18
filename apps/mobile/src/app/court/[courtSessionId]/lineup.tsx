import type { CourtSessionTimeline, TeamSide } from "@sacou/match-engine";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { courtHref } from "../../../features/court/navigation";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { useMatchLineup } from "../../../features/lineup/hooks/use-match-lineup";
import type { LineupSource } from "../../../features/lineup/model/lineup-source";
import { matchLineupSource, teamOfParam } from "../../../features/lineup/model/match-lineup-source";
import type { LineupDispatch } from "../../../features/lineup/model/save-match-lineups";
import { LineupScreen } from "../../../features/lineup/ui/LineupScreen";
import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";

export interface MatchLineupBodyProps {
  readonly source: LineupSource;
  readonly initialTab: TeamSide;
  readonly dispatch: LineupDispatch;
  readonly onLeave: () => void;
  readonly onSaved: () => void;
}

function MatchLineupBody(props: MatchLineupBodyProps) {
  const { screen, discard } = useMatchLineup(props);
  const texts = strings.lineup.discard;
  return (
    <>
      <LineupScreen {...screen} />
      <ConfirmSheet
        visible={discard.visible}
        title={texts.title}
        body={texts.body}
        confirmLabel={texts.confirm}
        cancelLabel={texts.cancel}
        onConfirm={discard.onConfirm}
        onCancel={discard.onCancel}
      />
    </>
  );
}

/**
 * Screen 22 opened by the menu of the match (E4.8, D7): the base is the replay of the log, and
 * "Salvar" goes back to the court, where the new lineup already plays. Without an open match there is
 * nothing to edit, so it goes back.
 */
export default function LineupRoute() {
  const route = useCourtRoute();
  const router = useRouter();
  const search = useLocalSearchParams<{ team?: string }>();
  const { courtRoster } = useServices();
  const { view, dispatch, retry } = useCourtSession();
  const timeline: CourtSessionTimeline | null = view.status === "ready" ? view.timeline : null;
  const source = useMemo(
    () => (timeline === null ? null : matchLineupSource(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const { backOrCourt, params } = route;
  const closed = timeline !== null && source === null;
  useEffect(() => {
    if (closed) backOrCourt();
  }, [closed, backOrCourt]);
  if (view.status === "failed") {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  if (source === null) {
    return null;
  }
  return (
    <MatchLineupBody
      source={source}
      initialTab={teamOfParam(search.team)}
      dispatch={dispatch}
      onLeave={backOrCourt}
      onSaved={() => {
        router.dismissTo(courtHref("court", params));
      }}
    />
  );
}
