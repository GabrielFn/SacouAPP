import type { SacouApi } from "../services/api/sacou-api";
import { round, type Client, type Execute } from "./http-path-params";

/** The draw of screen 07 (E4.7), apart from the rest to keep the adapter small. */
export function createDrawOperations(client: Client, execute: Execute): Pick<SacouApi, "drawTeams"> {
  return {
    drawTeams: (groupId, roundId, body) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/rounds/{roundId}/draw", {
          ...init,
          ...round(groupId, roundId),
          body,
        }),
      ),
  };
}
