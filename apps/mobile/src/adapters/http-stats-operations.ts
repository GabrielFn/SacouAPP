import type { SacouApi } from "../services/api/sacou-api";
import { round, type Client, type Execute } from "./http-path-params";

/** The operations of the Stats module; "getMyStats" (E4.13) and the vote (E4.18) join this file. */
export function createStatsOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "getRoundSummary"> {
  return {
    getRoundSummary: (groupId, roundId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/rounds/{roundId}/summary", {
          ...init,
          ...round(groupId, roundId),
        }),
      ),
  };
}
