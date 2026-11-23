import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { queryKeys } from "../../../services/query/query-keys";

export interface ClosedRound {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * The server closed the round: its detail (the new `endsAt`), its summary, the list and the person's own
 * numbers (the card of screen 14) are read again.
 */
export function useRoundClosed(): (round: ClosedRound) => void {
  const client = useQueryClient();
  return useCallback(
    ({ groupId, roundId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.round(groupId, roundId) });
      void client.invalidateQueries({ queryKey: queryKeys.roundSummary(groupId, roundId) });
      void client.invalidateQueries({ queryKey: queryKeys.rounds(groupId) });
      void client.invalidateQueries({ queryKey: queryKeys.myStats() });
    },
    [client],
  );
}
