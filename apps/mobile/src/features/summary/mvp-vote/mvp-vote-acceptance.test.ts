import { QueryObserver } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { ApiFailure, type ApiError } from "../../../services/api/api-error";
import { apiErr, apiOk, type ApiResult } from "../../../services/api/api-result";
import type { MvpBallot, MvpVote, SacouApi } from "../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import { GROUP } from "../../groups/model/members.test.fixture";
import { ballot, MEMBERS, NOW, ROUND, SCENARIOS } from "./model/mvp-ballot.test.fixture";
import { mvpVoteView } from "./model/mvp-vote-view";
import { INITIAL_MVP_VOTE } from "./model/mvp-vote.reducer";
import { castMvpVote, createVoteSubmitter, mvpVotingQuery } from "./queries/mvp-vote-queries";

const TARGET = { groupId: GROUP, roundId: ROUND };
const KEY = queryKeys.mvpVoting(GROUP, ROUND);
const VOTE: MvpVote = { candidateMemberId: "m-bia", castAt: "2026-11-20T03:00:00.000Z" };

function problem(status: number, code: Extract<ApiError, { kind: "problem" }>["code"]): ApiError {
  return { kind: "problem", status, code };
}

function viewOf(data: MvpBallot) {
  return mvpVoteView({
    query: { status: "success", data, error: null },
    members: MEMBERS,
    online: true,
    nowMs: NOW,
    vote: INITIAL_MVP_VOTE,
  });
}

function failedView(error: ApiError) {
  return mvpVoteView({
    query: { status: "error", data: undefined, error: new ApiFailure(error) },
    members: MEMBERS,
    online: true,
    nowMs: NOW,
    vote: INITIAL_MVP_VOTE,
  });
}

describe("acceptance of screen 12a (tester)", () => {
  test("every state of the table, with the right body", () => {
    expect(viewOf(SCENARIOS.notOpen).body.kind).toBe("not-open");
    expect(viewOf(SCENARIOS.open).body.kind).toBe("choosing");
    expect(viewOf(SCENARIOS.notPlayed).body.kind).toBe("not-eligible");
    expect(viewOf(SCENARIOS.voted).body.kind).toBe("already-voted");
    expect(viewOf(SCENARIOS.closed).body.kind).toBe("closed");
  });

  test("not eligible and closed carry no ballot rows nor candidate names", () => {
    for (const data of [SCENARIOS.notPlayed, SCENARIOS.closed, SCENARIOS.notOpen]) {
      const text = JSON.stringify(viewOf(data).body);
      expect(text).not.toContain("rows");
      for (const name of ["Bia", "Gabi", "Léo", "Nina"]) expect(text).not.toContain(name);
    }
  });

  test("already voted shows only the own vote, even with the candidates and canVote leaking in", () => {
    const data = ballot({
      canVote: true,
      reason: "alreadyVoted",
      myVote: { candidateMemberId: "m-leo", castAt: "2026-11-20T03:00:00.000Z" },
    });
    const text = JSON.stringify(viewOf(data).body);
    expect(text).toContain("Léo");
    for (const other of ["Bia", "Gabi", "Nina", "Caio", "Lia", "Marcos"]) {
      expect(text).not.toContain(other);
    }
  });

  test.each([[403], [404]])("%d gives a generic error with no candidate or code", (status) => {
    const body = failedView({ kind: "unexpected", status }).body;
    expect(body.kind).toBe("error");
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/stats\.|sessions\.|m-bia|Bia/);
  });

  test.each([
    "stats.mvp-already-voted",
    "stats.mvp-voting-closed",
    "stats.mvp-voting-not-open",
    "stats.mvp-voter-not-eligible",
    "stats.mvp-candidate-invalid",
    "stats.mvp-self-vote",
    "stats.mvp-voting-off",
  ] as const)("refusal %s reloads the ballot from the server", async (code) => {
    const fake = createFakeSacouApi();
    const client = createSacouQueryClient();
    client.setQueryData(KEY, SCENARIOS.open);
    const fresh = SCENARIOS.closed;
    fake.respond("castMvpVote", apiErr(problem(422, code)));
    fake.respond("getMvpVoting", apiOk(fresh));
    const observer = new QueryObserver(client, mvpVotingQuery(fake.api, GROUP, ROUND));
    const unsubscribe = observer.subscribe(() => undefined);

    await castMvpVote({ api: fake.api, client }, TARGET, "m-bia");
    await vi.waitFor(() => {
      expect(client.getQueryData<MvpBallot>(KEY)?.state).toBe("closed");
    });
    unsubscribe();
  });

  test("a double tap through the submitter sends one vote and the 201 shows without a new read", async () => {
    const fake = createFakeSacouApi();
    const client = createSacouQueryClient();
    client.setQueryData(KEY, SCENARIOS.open);
    const reads = vi.fn();
    let release: (result: ApiResult<MvpVote>) => void = () => undefined;
    const calls: string[] = [];
    const api: SacouApi = {
      ...fake.api,
      getMvpVoting: (...args) => {
        reads();
        return fake.api.getMvpVoting(...args);
      },
      castMvpVote: (_g, _r, candidate) => {
        calls.push(candidate);
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    };
    const submitter = createVoteSubmitter({ api, client }, TARGET);

    const first = submitter.submit("m-bia");
    const second = submitter.submit("m-bia");
    const third = submitter.submit("m-gabi");
    expect([second, third]).toEqual([null, null]);
    release(apiOk(VOTE));
    await first;

    expect(calls).toEqual(["m-bia"]);
    expect(reads).not.toHaveBeenCalled();
    const body = viewOf(client.getQueryData<MvpBallot>(KEY) as MvpBallot).body;
    expect(body).toMatchObject({ kind: "already-voted" });
    expect(JSON.stringify(body)).toContain("Bia");
  });
});
