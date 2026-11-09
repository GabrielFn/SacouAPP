import type { TeamSide } from "@sacou/match-engine";
import { useEffect, useMemo } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import {
  selectCourtPhase,
  selectSetEnd,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import {
  CourtPlaceholder,
  type PlaceholderAction,
} from "../../../features/court/ui/CourtPlaceholder";
import { useServices } from "../../../services/services-context";
import { strings } from "../../../strings/pt-BR";

const SIDES: readonly TeamSide[] = ["a", "b"];

/** Placeholder of screen 25 (E4.10): confirms the end of the set, and takes the toss of the decider. */
export default function SetEndRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
  const { view, dispatch } = useCourtSession();
  const timeline = view.status === "ready" ? view.timeline : null;
  const model = useMemo(
    () => (timeline === null ? null : selectSetEnd(timeline, courtRoster)),
    [timeline, courtRoster],
  );
  const phase = timeline === null ? null : selectCourtPhase(stateOfTimeline(timeline));
  const { backOrCourt } = route;

  // Once the set is confirmed the next one is being played; the end of the match is the court's to route.
  useEffect(() => {
    if (phase === "playing") {
      backOrCourt();
    }
  }, [phase, backOrCourt]);

  if (model === null) {
    return null;
  }
  const { setEnd } = strings.court;
  const confirm = (firstServer?: TeamSide) => {
    void dispatch(
      firstServer === undefined
        ? { type: "confirm-set-end" }
        : { type: "confirm-set-end", firstServer },
    );
  };
  const confirmActions: readonly PlaceholderAction[] = model.needsFirstServer
    ? SIDES.map((side) => ({
        label: setEnd.serves(model.scores[side].label),
        onPress: () => {
          confirm(side);
        },
      }))
    : [{ label: setEnd.confirm, onPress: confirm }];
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
