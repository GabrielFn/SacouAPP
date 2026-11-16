import { useQueries } from "@tanstack/react-query";

import type { MyGroup } from "../../../services/api/sacou-api";
import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { roundCardsOf, type RoundCards } from "../model/round-cards";
import { roundsQuery } from "../queries/round-queries";

/**
 * The next round of each group, read from one `listRounds` per group (the same cache key the round
 * screens use), and derived on each render: nothing is copied out of the cache (frontend.md, rule 1).
 * A group whose rounds are still loading or failed shows as a group without a round.
 */
export function useRoundCards(groups: readonly MyGroup[]): RoundCards {
  const { sacouApi } = useServices();
  const lists = useQueries({
    queries: groups.map((group) => roundsQuery(sacouApi, group.groupId)),
    combine: (results) => results.map((result) => result.data ?? []),
  });
  return roundCardsOf(groups, lists, wallClockNow());
}
