import { useMemo, useReducer } from "react";

import {
  correctionsReducer,
  INITIAL_CORRECTIONS,
} from "../../../features/court/corrections/corrections.reducer";
import {
  canShift,
  correctionsSubtitle,
  currentSetNumber,
  effectiveSelection,
  revertSheet,
  servingNotice,
  shiftOptions,
  timelineRows,
} from "../../../features/court/corrections/corrections-selectors";
import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import {
  selectCourtPhase,
  stateOfTimeline,
} from "../../../features/court/model/court-screen.selectors";
import { refusalText } from "../../../features/court/model/refusal-text";
import type { PlayCommand } from "../../../features/court/session/command-drafts";
import { CorrectionsScreen } from "../../../features/court/ui/CorrectionsScreen";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { useServices } from "../../../services/services-context";

/** Screen 24: the points of the set, going back to one of them, "Trocar sacador" and "Girar". */
export default function CorrectionsRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
  const { view, dispatch, retry } = useCourtSession();
  const [state, send] = useReducer(correctionsReducer, INITIAL_CORRECTIONS);
  const timeline = view.status === "ready" ? view.timeline : null;
  const selected = useMemo(
    () => (timeline === null ? null : effectiveSelection(timeline, state.selected)),
    [timeline, state.selected],
  );
  const model = useMemo(() => {
    if (timeline === null) {
      return null;
    }
    const options = shiftOptions(timeline, courtRoster);
    return {
      subtitle: correctionsSubtitle(timeline, courtRoster),
      setNumber: currentSetNumber(timeline),
      rows: timelineRows(timeline, courtRoster, selected),
      revert: revertSheet(timeline, courtRoster, selected),
      shiftOptions: options,
      canShift: canShift(options),
      canSwitchServer: selectCourtPhase(stateOfTimeline(timeline)) === "playing",
      servingNotice: servingNotice(timeline, courtRoster),
    };
  }, [timeline, courtRoster, selected]);
  if (view.status === "failed") {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  if (model === null) {
    return null;
  }
  // A refusal says why nothing happened; a command that goes through clears the last one.
  const run = (command: PlayCommand, onDone?: () => void) => {
    void dispatch(command).then((result) => {
      send(
        result.ok
          ? { type: "command-accepted" }
          : { type: "command-refused", text: refusalText(result.error) },
      );
      if (result.ok) {
        onDone?.();
      }
    });
  };
  const sheetState = { ...state, selected };
  return (
    <CorrectionsScreen
      {...model}
      state={sheetState}
      refusal={state.refusal}
      onClose={route.backOrCourt}
      onPointTapped={(eventId) => {
        send({ type: "point-tapped", eventId });
      }}
      onSwitchServer={() => {
        run({ type: "switch-serving-team" });
      }}
      onOpenShift={() => {
        send({ type: "shift-opened" });
      }}
      onChooseShiftTeam={(team) => {
        send({ type: "shift-team-chosen", team });
      }}
      onShift={(direction) => {
        run({ type: "shift-rotation", team: state.shiftTeam, direction });
      }}
      onCloseShift={() => {
        send({ type: "shift-closed" });
      }}
      onRevert={() => {
        if (selected !== null) {
          run({ type: "revert-to", eventId: selected }, route.backOrCourt);
        }
      }}
      onCancelRevert={() => {
        send({ type: "selection-cleared" });
      }}
    />
  );
}
