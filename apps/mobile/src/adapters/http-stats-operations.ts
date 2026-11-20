import type { SacouApi } from "../services/api/sacou-api";
import { round, type Client, type Execute } from "./http-path-params";

/** The operations of the Stats module: the person's own numbers (E4.13) and a round's summary (E4.12); the vote (E4.18) joins this file. */
export function createStatsOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "getMyStats" | "getRoundSummary"> {
  return {
    // No `year`: the server uses the current season in America/Sao_Paulo and answers it (`year`).
    getMyStats: () => execute((init) => client.GET("/v1/me/stats", init)),
    getRoundSummary: (groupId, roundId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/rounds/{roundId}/summary", {
          ...init,
          ...round(groupId, roundId),
        }),
      ),
  };
}
