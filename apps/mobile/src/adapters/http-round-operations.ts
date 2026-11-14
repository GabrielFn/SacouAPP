import type createClient from "openapi-fetch";

import type { paths } from "../api/generated/schema";
import type { ApiResult } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import type { Call } from "./http-sacou-api";

type Client = ReturnType<typeof createClient<paths>>;
type Execute = <T>(call: Call<T>) => Promise<ApiResult<T>>;

const group = (groupId: string) => ({ params: { path: { groupId } } });
const round = (groupId: string, roundId: string) => ({ params: { path: { groupId, roundId } } });

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
  | "respondAttendance"
  | "setMemberAttendance"
> {
  return {
    listRounds: (groupId) =>
      execute((init) => client.GET("/v1/groups/{groupId}/rounds", { ...init, ...group(groupId) })),
    getRound: (groupId, roundId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/rounds/{roundId}", { ...init, ...round(groupId, roundId) }),
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
  };
}
