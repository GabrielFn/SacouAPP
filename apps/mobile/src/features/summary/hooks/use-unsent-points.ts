import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { queryKeys } from "../../../services/query/query-keys";
import { useCourtSync } from "../../court/hooks/court-sync-context";

/**
 * Points of this round the phone still has to send, counted from the court log and never stored
 * (rule 1). The count is read again whenever the upload loop moves; when it drops, the server has
 * new points, so the summary is read again too.
 */
export function useUnsentPoints(groupId: string, roundId: string): number {
  const sync = useCourtSync();
  const client = useQueryClient();
  const loop = useSyncExternalStore(sync.subscribe, sync.getSnapshot).loop;
  const query = useQuery({
    queryKey: queryKeys.courtUnsent(roundId),
    queryFn: async () => (await sync.countUnsentOfRound(roundId)).points,
    gcTime: 0,
  });
  const points = query.data ?? 0;
  const previous = useRef(points);

  useEffect(() => {
    void client.invalidateQueries({ queryKey: queryKeys.courtUnsent(roundId) });
  }, [client, roundId, loop]);

  useEffect(() => {
    if (points < previous.current) {
      void client.invalidateQueries({ queryKey: queryKeys.roundSummary(groupId, roundId) });
    }
    previous.current = points;
  }, [client, groupId, roundId, points]);

  return points;
}
