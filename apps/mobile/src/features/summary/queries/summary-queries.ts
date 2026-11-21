import { queryOptions, type QueryClient } from "@tanstack/react-query";

import type { Scheduler } from "../../court/ports/scheduler";
import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { LONGEST_WAIT_MS } from "../mvp-vote/queries/mvp-vote-queries";

/** A correction after the end recalculates everything on the server (E3.9, 3.9), so it ages fast. */
export const SUMMARY_STALE_MS = 30_000;

export function roundSummaryQuery(api: SacouApi, groupId: string, roundId: string) {
  return queryOptions({
    queryKey: queryKeys.roundSummary(groupId, roundId),
    queryFn: () => unwrap(api.getRoundSummary(groupId, roundId)),
    staleTime: SUMMARY_STALE_MS,
  });
}

export interface SummaryTarget {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * At the next change of the voting by the clock (it opens or closes), marks the summary and the ballot
 * old so the open screen reads them again: the app never decides who won. The returned function cancels
 * the wait. Nothing at all once the voting is closed or when the change is further than a timer takes.
 */
export function scheduleSummaryRefresh(
  scheduler: Scheduler,
  client: Pick<QueryClient, "invalidateQueries">,
  { groupId, roundId }: SummaryTarget,
  changeAtMs: number | null,
  nowMs: number,
): () => void {
  if (changeAtMs === null) return () => undefined;
  const wait = Math.max(0, changeAtMs - nowMs);
  if (wait > LONGEST_WAIT_MS) return () => undefined;
  return scheduler.after(wait, () => {
    void client.invalidateQueries({ queryKey: queryKeys.roundSummary(groupId, roundId) });
    void client.invalidateQueries({ queryKey: queryKeys.mvpVoting(groupId, roundId) });
  });
}
