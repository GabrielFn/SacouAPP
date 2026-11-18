import { useCallback } from "react";

import { useServices } from "../../../services/services-context";
import { useCourtSummary, type CourtSummaryRead } from "../../../services/query/use-court-summary";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { courtAccountOf } from "../sync/court-account";
import {
  lookUpCourtSummary,
  waitOn,
  type CourtSummaryLookup,
} from "../takeover/court-summary-lookup";

/**
 * The summary of the court of a round (screens 06, 08, 09a and 09b): with the token of the account
 * signed in, waiting a `Retry-After` on the scheduler (ADR 0067, decision 14). Off while `enabled` is
 * false; without a network the query waits, and the screens go on as they were.
 */
export function useCourtSummaryLookup(
  origin: CourtSessionOrigin | null,
  enabled: boolean,
): CourtSummaryRead<CourtSummaryLookup> {
  const { sacouApi, scheduler, authSession } = useServices();
  const groupId = origin?.groupId ?? "";
  const roundId = origin?.roundId ?? "";
  const read = useCallback(
    () =>
      lookUpCourtSummary(
        {
          api: sacouApi,
          wait: waitOn(scheduler),
          account: () => courtAccountOf(authSession).current(),
        },
        { groupId, roundId },
      ),
    [sacouApi, scheduler, authSession, groupId, roundId],
  );
  return useCourtSummary({ groupId, roundId }, read, enabled && origin !== null);
}
