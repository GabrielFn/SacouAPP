import type { ApiResult } from "../../../services/api/api-result";
import type { CourtSessionSummary, SacouApi } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { withRetryAfter } from "./api-calls";

export interface CourtSummaryDeps {
  readonly api: Pick<SacouApi, "getCourtSession">;
  readonly wait: (ms: number) => Promise<void>;
}

export interface CourtSummaryRequest {
  readonly groupId: string;
  readonly roundId: string;
  /** The account signed in now: the summary is read only with its token (ADR 0067, D8). */
  readonly account: SessionIdentity;
}

/**
 * The summary screen 09a shows before "Assumir o placar" (D5): a 429 or a 503 waits its `Retry-After`,
 * as the take-over and the import do (ADR 0062).
 */
export function readCourtSummary(
  deps: CourtSummaryDeps,
  { groupId, roundId, account }: CourtSummaryRequest,
): Promise<ApiResult<CourtSessionSummary>> {
  return withRetryAfter(() => deps.api.getCourtSession(groupId, roundId, account), deps.wait);
}
