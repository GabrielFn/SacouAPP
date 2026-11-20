import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "../../../services/api/api-result";
import type { SacouApi } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";

/** A match ends on this phone and on others: the numbers are read again soon, the server sums on read. */
export const MY_STATS_STALE_MS = 60_000;

/**
 * The person's own numbers (screen 14). The key sits under `["me"]`, which `clearSession` empties with
 * the rest of the cache, so another account never sees them. No `year`: the server picks the season.
 */
export function myStatsQuery(api: SacouApi, enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.myStats(),
    queryFn: () => unwrap(api.getMyStats()),
    staleTime: MY_STATS_STALE_MS,
    enabled,
  });
}
