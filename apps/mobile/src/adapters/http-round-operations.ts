import type { SacouApi } from "../services/api/sacou-api";
import { createDrawOperations } from "./http-draw-operations";
import { group, round, type Client, type Execute } from "./http-path-params";

/** The operations of the rounds and the presence, apart from the rest to keep the adapter small (E4.6). */
export function createRoundOperations(
  client: Client,
  execute: Execute,
): Pick<
  SacouApi,
  | "listRounds"
  | "getRound"
  | "createRound"
  | "updateRound"
  | "closeRound"
  | "respondAttendance"
  | "setMemberAttendance"
  | "addGuest"
  | "drawTeams"
> {
  return {
    ...createDrawOperations(client, execute),
    listRounds: (groupId) =>
      execute((init) => client.GET("/v1/groups/{groupId}/rounds", { ...init, ...group(groupId) })),
    getRound: (groupId, roundId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/rounds/{roundId}", {
          ...init,
          ...round(groupId, roundId),
        }),
      ),
    createRound: (groupId, body) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/rounds", { ...init, ...group(groupId), body }),
      ),
    updateRound: (groupId, roundId, body) =>
      execute((init) =>
        client.PATCH("/v1/groups/{groupId}/rounds/{roundId}", {
          ...init,
          ...round(groupId, roundId),
          body,
        }),
      ),
    closeRound: (groupId, roundId) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/rounds/{roundId}/close", {
          ...init,
          ...round(groupId, roundId),
        }),
      ),
    respondAttendance: (groupId, roundId, response) =>
      execute((init) =>
        client.PUT("/v1/groups/{groupId}/rounds/{roundId}/attendance/me", {
          ...init,
          ...round(groupId, roundId),
          body: { response },
        }),
      ),
    setMemberAttendance: (ref, response) =>
      execute((init) =>
        client.PUT("/v1/groups/{groupId}/rounds/{roundId}/attendance/{memberId}", {
          ...init,
          params: { path: { groupId: ref.groupId, roundId: ref.roundId, memberId: ref.memberId } },
          body: { response },
        }),
      ),
    addGuest: (groupId, body) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/guests", { ...init, ...group(groupId), body }),
      ),
  };
}
