import type { SessionIdentity } from "../services/auth/auth-session";
import type { ApiResult } from "../services/api/api-result";
import type { SacouApi } from "../services/api/sacou-api";
import type { Call } from "./http-sacou-api";
import type { Client } from "./http-path-params";

/** Runs a call only with the token of `account` (ADR 0067, D8). */
export type ExecuteAs = <T>(call: Call<T>, account: SessionIdentity) => Promise<ApiResult<T>>;

/** The court stream (E4.11), apart from the rest to keep the adapter small. */
export function createCourtOperations(
  client: Client,
  executeAs: ExecuteAs,
): Pick<SacouApi, "appendCourtEvents"> {
  return {
    appendCourtEvents: (ref, envelopes, account) =>
      executeAs(
        (init) =>
          client.POST(
            "/v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events",
            {
              ...init,
              params: { path: ref },
              // A copy of each envelope as a plain object: the contract types it as a JSON object.
              body: { events: envelopes.map((envelope) => ({ ...envelope })) },
            },
          ),
        account,
      ),
  };
}
