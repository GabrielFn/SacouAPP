import { QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createFakeClock } from "../../../../adapters/fake-clock";
import { createFakeSacouApi } from "../../../../adapters/fake-sacou-api";
import { createFakeScheduler } from "../../../../adapters/fake-scheduler";
import type { ApiError } from "../../../../services/api/api-error";
import { apiErr, apiOk, type ApiResult } from "../../../../services/api/api-result";
import type { MvpBallot, MvpVote, SacouApi } from "../../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../../services/query/query-client";
import { queryKeys } from "../../../../services/query/query-keys";
import { GROUP } from "../../../groups/model/members.test.fixture";
import { ballot, MEMBERS, NOW, ROUND, SCENARIOS } from "../model/mvp-ballot.test.fixture";
import { mvpVoteView } from "../model/mvp-vote-view";
import { INITIAL_MVP_VOTE } from "../model/mvp-vote.reducer";
import {
  castMvpVote,
  createVoteSubmitter,
  mvpVotingQuery,
  nextBallotChangeAt,
  scheduleBallotRefresh,
} from "./mvp-vote-queries";

const TARGET = { groupId: GROUP, roundId: ROUND };
const VOTE: MvpVote = { candidateMemberId: "m-bia", castAt: "2026-11-20T03:00:00.000Z" };
const KEY = queryKeys.mvpVoting(GROUP, ROUND);

function problem(status: number, code: Extract<ApiError, { kind: "problem" }>["code"]): ApiError {
  return { kind: "problem", status, code };
}

function setup(initial: MvpBallot = SCENARIOS.open) {
  const fake = createFakeSacouApi();
  const client = createSacouQueryClient();
  client.setQueryData(KEY, initial);
  return { fake, client, deps: { api: fake.api, client } };
}

function bodyKindOf(client: ReturnType<typeof createSacouQueryClient>) {
  const data = client.getQueryData<MvpBallot>(KEY);
  return mvpVoteView({
    query: { status: "success", data, error: null },
    members: MEMBERS,
    online: true,
    nowMs: NOW,
    vote: INITIAL_MVP_VOTE,
  }).body;
}

/** A vote that answers only when the test lets it: two taps arrive while it is on the way. */
function slowVote(fake: ReturnType<typeof createFakeSacouApi>) {
  const pending: { release: (result: ApiResult<MvpVote>) => void } = { release: () => undefined };
  const calls: string[] = [];
  const api: SacouApi = {
    ...fake.api,
    castMvpVote: (_groupId, _roundId, candidateMemberId) => {
      calls.push(candidateMemberId);
      return new Promise((resolve) => {
        pending.release = resolve;
      });
    },
  };
  return { api, calls, release: (result: ApiResult<MvpVote>) => pending.release(result) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the vote through the cache", () => {
  test("D1 201 puts the vote in the ballot with no new read, and the summary is read again", async () => {
    const { fake, client, deps } = setup();
    fake.respond("castMvpVote", apiOk(VOTE));
    client.setQueryData(queryKeys.roundSummary(GROUP, ROUND), { finishedMatches: 6 });

    const result = await castMvpVote(deps, TARGET, "m-bia");

    expect(result.ok).toBe(true);
    expect(fake.calls()).toEqual([{ operation: "castMvpVote", args: [GROUP, ROUND, "m-bia"] }]);
    expect(client.getQueryData<MvpBallot>(KEY)?.myVote).toEqual(VOTE);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.roundSummary(GROUP, ROUND))?.isInvalidated).toBe(true);
    expect(bodyKindOf(client)).toMatchObject({ kind: "already-voted" });
  });

  test("D2 409 already voted reads the ballot again and shows the server's vote", async () => {
    const { fake, client, deps } = setup();
    fake.respond("castMvpVote", apiErr(problem(409, "stats.mvp-already-voted")));
    const theirs = ballot({
      canVote: false,
      reason: "alreadyVoted",
      myVote: { candidateMemberId: "m-gabi", castAt: "2026-11-20T02:40:00.000Z" },
    });
    fake.respond("getMvpVoting", apiOk(theirs));
    const observer = new QueryObserver(client, mvpVotingQuery(fake.api, GROUP, ROUND));
    const unsubscribe = observer.subscribe(() => undefined);

    await castMvpVote(deps, TARGET, "m-bia");
    await vi.waitFor(() => {
      expect(client.getQueryData<MvpBallot>(KEY)?.myVote?.candidateMemberId).toBe("m-gabi");
    });
    unsubscribe();

    expect(bodyKindOf(client)).toEqual({
      kind: "already-voted",
      voted: "Você votou em Gabi. Seu voto é secreto.",
      result: "O resultado sai quando a votação fechar, em 23 h.",
    });
  });

  test.each([
    [422, "stats.mvp-voting-closed"],
    [422, "stats.mvp-voting-not-open"],
    [422, "stats.mvp-candidate-invalid"],
    [403, "stats.mvp-voter-not-eligible"],
  ] as const)("D3, D4, D6 %d %s marks the ballot old", async (status, code) => {
    const { fake, client, deps } = setup();
    fake.respond("castMvpVote", apiErr(problem(status, code)));

    const result = await castMvpVote(deps, TARGET, "m-bia");

    expect(result.ok).toBe(false);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryData<MvpBallot>(KEY)?.myVote).toBeNull();
  });

  test("D3 and D6 the ballot read again decides the screen: closed, not eligible", async () => {
    const { client } = setup(SCENARIOS.closed);
    expect(bodyKindOf(client).kind).toBe("closed");
    client.setQueryData(KEY, SCENARIOS.notPlayed);
    expect(bodyKindOf(client).kind).toBe("not-eligible");
  });

  test("D5 a network failure keeps the ballot as it was", async () => {
    const { fake, client, deps } = setup();
    fake.respond("castMvpVote", apiErr({ kind: "offline" }));

    const result = await castMvpVote(deps, TARGET, "m-bia");

    expect(result).toEqual({ ok: false, error: { kind: "offline" } });
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(false);
  });

  test("B3 two taps while the vote is on the way send it once", async () => {
    const { fake, client } = setup();
    const slow = slowVote(fake);
    const submitter = createVoteSubmitter({ api: slow.api, client }, TARGET);

    const first = submitter.submit("m-bia");
    const second = submitter.submit("m-bia");
    expect(second).toBeNull();
    slow.release(apiOk(VOTE));
    await first;

    expect(slow.calls).toEqual(["m-bia"]);
    expect(submitter.submit("m-bia")).not.toBeNull();
  });

  test("S4 nothing is written to the console with the candidate or the voter", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const { fake, deps } = setup();
    fake.respond("castMvpVote", apiOk(VOTE));
    await castMvpVote(deps, TARGET, "m-bia");
    fake.respond("castMvpVote", apiErr(problem(422, "stats.mvp-candidate-invalid")));
    await castMvpVote(deps, TARGET, "m-bia");

    const written = spies.flatMap((spy) => spy.mock.calls).flat().map(String).join(" ");
    expect(written).not.toContain("m-bia");
    expect(written).not.toContain("m-me");
  });
});

describe("the ballot read again by the clock (V7)", () => {
  test("open: at closesAt the ballot is marked old, never closed by the app", () => {
    const clock = createFakeClock();
    const scheduler = createFakeScheduler(clock);
    const { client } = setup();
    const changeAt = nextBallotChangeAt(SCENARIOS.open);

    scheduleBallotRefresh(scheduler, client, TARGET, changeAt, NOW);
    expect(scheduler.pendingDelays()).toEqual([Date.parse(SCENARIOS.open.closesAt) - NOW]);
    scheduler.advance(Date.parse(SCENARIOS.open.closesAt) - NOW);

    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
    expect(client.getQueryData<MvpBallot>(KEY)?.state).toBe("open");
  });

  test("not open waits for opensAt; closed waits for nothing; leaving cancels", () => {
    const clock = createFakeClock();
    const scheduler = createFakeScheduler(clock);
    const { client } = setup();

    expect(nextBallotChangeAt(SCENARIOS.notOpen)).toBe(Date.parse(SCENARIOS.notOpen.opensAt));
    expect(nextBallotChangeAt(SCENARIOS.closed)).toBeNull();
    expect(nextBallotChangeAt(undefined)).toBeNull();
    scheduleBallotRefresh(scheduler, client, TARGET, null, NOW);
    expect(scheduler.pendingDelays()).toEqual([]);

    const cancel = scheduleBallotRefresh(scheduler, client, TARGET, NOW + 1_000, NOW);
    cancel();
    expect(scheduler.pendingDelays()).toEqual([]);
  });

  test("a moment already gone reads at once", () => {
    const clock = createFakeClock();
    const scheduler = createFakeScheduler(clock);
    const { client } = setup();
    scheduleBallotRefresh(scheduler, client, TARGET, NOW - 1_000, NOW);
    expect(scheduler.pendingDelays()).toEqual([0]);
  });
});
