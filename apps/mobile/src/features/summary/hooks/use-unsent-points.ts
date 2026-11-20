import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { queryKeys } from "../../../services/query/query-keys";
import { useCourtSync } from "../../court/hooks/court-sync-context";
import type { CourtSync } from "../../court/ports/court-sync";

/** The log is local, so the query runs without internet too: the warning is most needed offline. */
export function unsentPointsQuery(sync: Pick<CourtSync, "countUnsentOfRound">, roundId: string) {
  return queryOptions({
    queryKey: queryKeys.courtUnsent(roundId),
    queryFn: async () => (await sync.countUnsentOfRound(roundId)).points,
    gcTime: 0,
    networkMode: "always",
  });
}

/**
 * Points of this round the phone still has to send, counted from the court log and never stored
 * (rule 1). The count is read again whenever the upload loop moves. The log is local, so the query
 * runs without internet too (see `unsentPointsQuery`). The
 * summary itself is read again by the loop when the server confirms points (see `DatabaseGate`).
 */
export function useUnsentPoints(roundId: string): number {
  const sync = useCourtSync();
  const client = useQueryClient();
  const loop = useSyncExternalStore(sync.subscribe, sync.getSnapshot).loop;
  const query = useQuery(unsentPointsQuery(sync, roundId));

  useEffect(() => {
    void client.invalidateQueries({ queryKey: queryKeys.courtUnsent(roundId) });
  }, [client, roundId, loop]);

  return query.data ?? 0;
}
