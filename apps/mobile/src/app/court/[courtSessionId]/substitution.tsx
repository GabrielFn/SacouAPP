import { useMemo, useReducer } from "react";

import { useCourtRoute } from "../../../features/court/hooks/use-court-route";
import { useCourtSession } from "../../../features/court/hooks/use-court-session";
import { refusalText } from "../../../features/court/model/refusal-text";
import { substitutionView } from "../../../features/court/substitution/substitution-selectors";
import {
  INITIAL_SUBSTITUTION,
  substitutionReducer,
} from "../../../features/court/substitution/substitution.reducer";
import { CourtFailedView } from "../../../features/court/ui/CourtFailedView";
import { SubstitutionScreen } from "../../../features/court/ui/SubstitutionScreen";
import { useServices } from "../../../services/services-context";

/** Screen 23a, from the menu and back to it. With nobody on a bench it shows nothing. */
export default function SubstitutionRoute() {
  const route = useCourtRoute();
  const { courtRoster } = useServices();
  const { view, dispatch, retry } = useCourtSession();
  const [state, send] = useReducer(substitutionReducer, INITIAL_SUBSTITUTION);
  const timeline = view.status === "ready" ? view.timeline : null;
  const model = useMemo(
    () => (timeline === null ? null : substitutionView(timeline, courtRoster, state)),
    [timeline, courtRoster, state],
  );
  if (view.status === "failed") {
    return <CourtFailedView onRetry={retry} onLeave={route.leave} />;
  }
  if (model === null) {
    return null;
  }
  const confirm = () => {
    const { picks, team } = model;
    if (picks === null) {
      return;
    }
    void dispatch({ type: "substitute-player", team, ...picks }).then((result) => {
      if (result.ok) {
        route.back();
      } else {
        send({ type: "command-refused", text: refusalText(result.error) });
      }
    });
  };
  return (
    <SubstitutionScreen
      view={model}
      refusal={state.refusal}
      onClose={route.back}
      onChooseTeam={(team) => {
        send({ type: "team-chosen", team });
      }}
      onChooseOutgoing={(memberId) => {
        send({ type: "outgoing-chosen", memberId });
      }}
      onChooseIncoming={(memberId) => {
        send({ type: "incoming-chosen", memberId });
      }}
      onConfirm={confirm}
    />
  );
}
