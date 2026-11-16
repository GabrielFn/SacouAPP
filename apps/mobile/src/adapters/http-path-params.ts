import type createClient from "openapi-fetch";

import type { paths } from "../api/generated/schema";
import type { ApiResult } from "../services/api/api-result";
import type { MemberRef } from "../services/api/sacou-api";
import type { Call } from "./http-sacou-api";

/** What the split operation files of the HTTP adapter share: the typed client and the call runner. */
export type Client = ReturnType<typeof createClient<paths>>;
export type Execute = <T>(call: Call<T>) => Promise<ApiResult<T>>;

export const group = (groupId: string) => ({ params: { path: { groupId } } });
export const member = (ref: MemberRef) => ({
  params: { path: { groupId: ref.groupId, memberId: ref.memberId } },
});
export const round = (groupId: string, roundId: string) => ({
  params: { path: { groupId, roundId } },
});
