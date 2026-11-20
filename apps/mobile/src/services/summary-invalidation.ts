import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "./query/query-keys";

export interface AcknowledgedRound {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * The server confirmed points of a round: its summary is read again (E4.12). Kept apart from the gate
 * so the rule is tested with a client, without the screens.
 */
export function invalidateSummaryOfRound(
  client: Pick<QueryClient, "invalidateQueries">,
  { groupId, roundId }: AcknowledgedRound,
): void {
  void client.invalidateQueries({ queryKey: queryKeys.roundSummary(groupId, roundId) });
}
