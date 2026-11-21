import { queryOptions, type QueryClient, type QueryKey } from "@tanstack/react-query";

import type { ApiErrorCode } from "../../../../api/generated/error-codes";
import type { Scheduler } from "../../../../services/scheduler/scheduler";
import type { ApiError } from "../../../../services/api/api-error";
import { unwrap, type ApiResult } from "../../../../services/api/api-result";
import type { MvpBallot, MvpVote, SacouApi } from "../../../../services/api/sacou-api";
import { queryKeys } from "../../../../services/query/query-keys";

/** The window and the eligibility change on the server only: the ballot is read again after 30 s. */
export const MVP_VOTING_STALE_MS = 30_000;

export function mvpVotingQuery(api: SacouApi, groupId: string, roundId: string) {
  return queryOptions({
    queryKey: queryKeys.mvpVoting(groupId, roundId),
    queryFn: () => unwrap(api.getMvpVoting(groupId, roundId)),
    staleTime: MVP_VOTING_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** Refusals that mean the ballot the phone has is old: it is read again and the server says the state. */
const REFRESHING_REFUSALS: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "stats.mvp-already-voted",
  "stats.mvp-voting-closed",
  "stats.mvp-voting-not-open",
  "stats.mvp-voter-not-eligible",
  "stats.mvp-candidate-invalid",
  "stats.mvp-self-vote",
  "stats.mvp-voting-off",
]);

function refreshes(error: ApiError): boolean {
  return error.kind === "problem" && REFRESHING_REFUSALS.has(error.code);
}

export interface MvpVoteDeps {
  readonly api: SacouApi;
  readonly client: Pick<QueryClient, "setQueryData" | "invalidateQueries">;
}

export interface MvpVoteTarget {
  readonly groupId: string;
  readonly roundId: string;
}

/**
 * Sends the vote. On `201` the answer goes into the ballot in the cache (the one record of `myVote`)
 * with no new read, and the summary is read again; on a refusal that says the ballot is old, the ballot
 * is read again. Nothing is logged: neither the candidate nor the voter (section 4, item 5).
 */
export async function castMvpVote(
  deps: MvpVoteDeps,
  { groupId, roundId }: MvpVoteTarget,
  candidateMemberId: string,
): Promise<ApiResult<MvpVote>> {
  const result = await deps.api.castMvpVote(groupId, roundId, candidateMemberId);
  const ballotKey = queryKeys.mvpVoting(groupId, roundId);
  if (result.ok) {
    deps.client.setQueryData<MvpBallot>(ballotKey, (ballot) =>
      ballot === undefined
        ? ballot
        : { ...ballot, myVote: result.value, canVote: false, reason: "alreadyVoted" },
    );
    void deps.client.invalidateQueries({ queryKey: queryKeys.roundSummary(groupId, roundId) });
  } else if (refreshes(result.error)) {
    void deps.client.invalidateQueries({ queryKey: ballotKey });
  }
  return result;
}

export interface VoteSubmitter {
  /** `null` when a vote is already on the way: a second tap never sends a second vote. */
  submit(candidateMemberId: string): Promise<ApiResult<MvpVote>> | null;
}

/** One vote on the way at a time, even when two taps arrive before the screen draws again (B3). */
export function createVoteSubmitter(deps: MvpVoteDeps, target: MvpVoteTarget): VoteSubmitter {
  const busy = { value: false };
  return {
    submit(candidateMemberId) {
      if (busy.value) return null;
      busy.value = true;
      return castMvpVote(deps, target, candidateMemberId).finally(() => {
        busy.value = false;
      });
    },
  };
}

/**
 * When the ballot changes by the clock alone: it opens at `opensAt` and closes at `closesAt`. The app
 * does not decide it: at that moment it reads the ballot again (V7). `null` once it is closed.
 */
export function nextBallotChangeAt(
  ballot: Pick<MvpBallot, "state" | "opensAt" | "closesAt"> | undefined | null,
): number | null {
  if (ballot === null) return null;
  if (ballot === undefined) return null;
  switch (ballot.state) {
    case "notOpen":
      return Date.parse(ballot.opensAt);
    case "open":
      return Date.parse(ballot.closesAt);
    case "closed":
      return null;
  }
}

/** The longest wait a timer takes (2^31 − 1 ms, about 24 days); a later change waits for the next opening. */
const LONGEST_WAIT_MS = 2_147_483_647;

/**
 * At `changeAtMs`, marks the queries of `keys` old so the open screen reads them again; the returned
 * function cancels the wait. Nothing at all without a moment (`null`) or when it is further than a timer takes.
 */
export function scheduleInvalidation(
  scheduler: Scheduler,
  client: Pick<QueryClient, "invalidateQueries">,
  keys: readonly QueryKey[],
  changeAtMs: number | null,
  nowMs: number,
): () => void {
  if (changeAtMs === null) return () => undefined;
  const wait = Math.max(0, changeAtMs - nowMs);
  if (wait > LONGEST_WAIT_MS) return () => undefined;
  return scheduler.after(wait, () => {
    for (const queryKey of keys) void client.invalidateQueries({ queryKey });
  });
}

/** At the next change of the ballot by the clock, the open screen reads the ballot again (V7). */
export function scheduleBallotRefresh(
  scheduler: Scheduler,
  client: Pick<QueryClient, "invalidateQueries">,
  { groupId, roundId }: MvpVoteTarget,
  changeAtMs: number | null,
  nowMs: number,
): () => void {
  const keys = [queryKeys.mvpVoting(groupId, roundId)];
  return scheduleInvalidation(scheduler, client, keys, changeAtMs, nowMs);
}
