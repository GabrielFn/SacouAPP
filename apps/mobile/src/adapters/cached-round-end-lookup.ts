import type { QueryClient } from "@tanstack/react-query";

import type { RoundEndLookup } from "../features/court/ports/round-end-lookup";
import { roundEndOf } from "../features/court/session/round-end";
import type { RoundSummary } from "../services/api/sacou-api";
import { queryKeys } from "../services/query/query-keys";

/**
 * The end of the round of a session from the persisted `["groups", g, "rounds"]` of the TanStack cache
 * (R97, D4): the list the home and the groups tab read, kept offline (E4.2). Read only, never fetched.
 */
export function createCachedRoundEndLookup(client: QueryClient): RoundEndLookup {
  return {
    endOf({ groupId, roundId }, now) {
      const state = client.getQueryState<readonly RoundSummary[]>(queryKeys.rounds(groupId));
      const rounds = state?.data;
      const list =
        rounds === undefined || state === undefined
          ? undefined
          : { rounds, updatedAt: state.dataUpdatedAt };
      return roundEndOf(list, roundId, now);
    },
  };
}
