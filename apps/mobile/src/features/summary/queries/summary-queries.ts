import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

/** A correction after the end recalculates everything on the server (E3.9, 3.9), so it ages fast. */
export const SUMMARY_STALE_MS = 30_000;

export function roundSummaryQuery(api: SacouApi, groupId: string, roundId: string) {
  return queryOptions({
    queryKey: queryKeys.roundSummary(groupId, roundId),
    queryFn: () => unwrap(api.getRoundSummary(groupId, roundId)),
    staleTime: SUMMARY_STALE_MS,
  });
}
