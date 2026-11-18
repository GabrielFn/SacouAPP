import type { SessionIdentity } from "../services/auth/auth-session";
import type { ApiResult } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import type { Call } from "./http-sacou-api";
import type { Client } from "./http-path-params";

/** Runs a call only with the token of `account` (ADR 0067, D8). */
export type ExecuteAs = <T>(call: Call<T>, account: SessionIdentity | null) => Promise<ApiResult<T>>;

const STREAM_PATH = "/v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events";

/** The court stream (E4.11), apart from the rest to keep the adapter small. */
export function createCourtOperations(
  client: Client,
  executeAs: ExecuteAs,
): Pick<SacouApi, "appendCourtEvents" | "getCourtSession" | "takeOverCourt" | "listCourtEvents"> {
  return {
    appendCourtEvents: (ref, envelopes, account) =>
      executeAs(
        (init) =>
          client.POST(STREAM_PATH, {
            ...init,
            params: { path: ref },
            // A copy of each envelope as a plain object: the contract types it as a JSON object.
            body: { events: envelopes.map((envelope) => ({ ...envelope })) },
          }),
        account,
      ),
    getCourtSession: (groupId, roundId) =>
      executeAs(
        (init) =>
          client.GET("/v1/groups/{groupId}/rounds/{roundId}/court-session", {
            ...init,
            params: { path: { groupId, roundId } },
          }),
        null,
      ),
    takeOverCourt: (ref, body, account) =>
      executeAs(
        (init) =>
          client.POST(
            "/v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/takeover",
            { ...init, params: { path: ref }, body },
          ),
        account,
      ),
    listCourtEvents: (ref, after) =>
      executeAs(
        (init) =>
          client.GET(STREAM_PATH, {
            ...init,
            // Only digits reach the server (ADR 0063, D13): the import passes a whole count.
            params: { path: ref, query: { after: String(after) } },
          }),
        null,
      ),
  };
}
