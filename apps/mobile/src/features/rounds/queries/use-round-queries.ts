import { useQuery } from "@tanstack/react-query";

import { useServices } from "../../../services/services-context";
import { roundQuery, roundsQuery } from "./round-queries";

// The data stays only in the query cache (frontend.md, rule 1): these hooks return the query as it is.

export function useRounds(groupId: string) {
  const { sacouApi } = useServices();
  return useQuery(roundsQuery(sacouApi, groupId));
}

export function useRound(groupId: string, roundId: string) {
  const { sacouApi } = useServices();
  return useQuery(roundQuery(sacouApi, groupId, roundId));
}
