import type { SacouApi } from "../services/api/sacou-api";
import { round, type Client, type Execute } from "./http-path-params";

/** The operations of the Stats module: the person's own numbers (E4.13), a round's summary (E4.12) and the MVP vote (E4.18). */
export function createStatsOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "getMyStats" | "getRoundSummary" | "getMvpVoting" | "castMvpVote"> {
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
    getMvpVoting: (groupId, roundId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/rounds/{roundId}/mvp-voting", {
          ...init,
          ...round(groupId, roundId),
        }),
      ),
    // The `result` route is not read: the outcome comes in the summary and the voters never show (question 174).
    castMvpVote: (groupId, roundId, candidateMemberId) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/rounds/{roundId}/mvp-voting/vote", {
          ...init,
          ...round(groupId, roundId),
          body: { candidateMemberId },
        }),
      ),
  };
}
