import type { SacouApi } from "../services/api/sacou-api";
import { group, member, type Client, type Execute } from "./http-path-params";

/** The operations of the admin's level, apart from the rest to keep the adapter small (E4.5, part 3). */
export function createLevelOperations(
  client: Client,
  execute: Execute,
): Pick<SacouApi, "listMemberLevels" | "setMemberLevel" | "setMemberLevels"> {
  return {
    listMemberLevels: (groupId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/member-levels", { ...init, ...group(groupId) }),
      ),
    setMemberLevel: (ref, level) =>
      execute((init) =>
        client.PUT("/v1/groups/{groupId}/member-levels/{memberId}", {
          ...init,
          ...member(ref),
          body: { level },
        }),
      ),
    setMemberLevels: (groupId, levels) =>
      execute((init) =>
        client.PUT("/v1/groups/{groupId}/member-levels", {
          ...init,
          ...group(groupId),
          body: { levels: [...levels] },
        }),
      ),
  };
}
