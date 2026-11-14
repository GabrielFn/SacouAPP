import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

/** Presence changes more often than the group, so a round is fresh for a shorter time (ADR 0054). */
export const ROUND_STALE_MS = 15_000;

export function roundsQuery(api: SacouApi, groupId: string) {
  return queryOptions({
    queryKey: queryKeys.rounds(groupId),
    queryFn: () => unwrap(api.listRounds(groupId)),
    staleTime: ROUND_STALE_MS,
  });
}

export function roundQuery(api: SacouApi, groupId: string, roundId: string) {
  return queryOptions({
    queryKey: queryKeys.round(groupId, roundId),
    queryFn: () => unwrap(api.getRound(groupId, roundId)),
    staleTime: ROUND_STALE_MS,
  });
}
