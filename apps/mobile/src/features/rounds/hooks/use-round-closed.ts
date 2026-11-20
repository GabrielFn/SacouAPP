import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { queryKeys } from "../../../services/query/query-keys";

export interface ClosedRound {
  readonly groupId: string;
  readonly roundId: string;
}

/** The server closed the round: its detail (the new `endsAt`), its summary and the list are read again. */
export function useRoundClosed(): (round: ClosedRound) => void {
  const client = useQueryClient();
  return useCallback(
    ({ groupId, roundId }) => {
      void client.invalidateQueries({ queryKey: queryKeys.round(groupId, roundId) });
      void client.invalidateQueries({ queryKey: queryKeys.rounds(groupId) });
    },
    [client],
  );
}
