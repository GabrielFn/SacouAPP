import { useCourtSessionOrigin } from "../../../services/query/use-court-session-origin";
import { useServices } from "../../../services/services-context";
import { findSessionOrigin, isIndividualPoints } from "../session/individual-points";
import { useCourtRuntime } from "./court-runtime-context";
import { useCourtSession } from "./use-court-session";

/**
 * "Ponto individual" of the round of the open court session. Only the origin of the session is
 * fetched (once, from the court log); the option is worked out on each draw from the rounds cache,
 * so it holds until the court is reopened and no copy of it is kept in state. Until the origin
 * answers, the option counts as off.
 */
export function useIndividualPoints(): boolean {
  const { log } = useCourtRuntime();
  const { courtRoundSettings } = useServices();
  const { courtSessionId } = useCourtSession();
  const origin = useCourtSessionOrigin(courtSessionId, () =>
    findSessionOrigin(log, courtSessionId),
  );
  return isIndividualPoints(origin, courtRoundSettings);
}
