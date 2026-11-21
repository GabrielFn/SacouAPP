import { queryOptions, type QueryClient } from "@tanstack/react-query";

import type { Scheduler } from "../../court/ports/scheduler";
import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { scheduleInvalidation, type MvpVoteTarget } from "../mvp-vote/queries/mvp-vote-queries";

/** A correction after the end recalculates everything on the server (E3.9, 3.9), so it ages fast. */
export const SUMMARY_STALE_MS = 30_000;

export function roundSummaryQuery(api: SacouApi, groupId: string, roundId: string) {
  return queryOptions({
    queryKey: queryKeys.roundSummary(groupId, roundId),
    queryFn: () => unwrap(api.getRoundSummary(groupId, roundId)),
    staleTime: SUMMARY_STALE_MS,
  });
}

/**
 * At the next change of the voting by the clock (it opens or closes), marks the summary and the ballot
 * old so the open screen reads them again: the app never decides who won. The returned function cancels
 * the wait.
 */
export function scheduleSummaryRefresh(
  scheduler: Scheduler,
  client: Pick<QueryClient, "invalidateQueries">,
  { groupId, roundId }: MvpVoteTarget,
  changeAtMs: number | null,
  nowMs: number,
): () => void {
  const keys = [queryKeys.roundSummary(groupId, roundId), queryKeys.mvpVoting(groupId, roundId)];
  return scheduleInvalidation(scheduler, client, keys, changeAtMs, nowMs);
}
