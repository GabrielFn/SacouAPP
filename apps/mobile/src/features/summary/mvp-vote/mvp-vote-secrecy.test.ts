import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { createCacheSession } from "../../../services/query/cache-persister";
import { isPersistedKey } from "../../../services/query/persist-policy";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import type { MvpBallot } from "../../../services/api/sacou-api";
import { E2_9_ROUND } from "../model/e2-9-round.test.fixture";
import { summaryShareText } from "../model/summary-share-text";
import { summaryView } from "../model/summary-view";
import { GROUP } from "../../groups/model/members.test.fixture";
import { ballot, CLOSES_AT, MEMBERS, NOW, OPENS_AT, ROUND } from "./model/mvp-ballot.test.fixture";
import { mvpVoteView } from "./model/mvp-vote-view";
import { INITIAL_MVP_VOTE } from "./model/mvp-vote.reducer";

const STRINGS = join(__dirname, "..", "..", "..", "strings");
const SCANNED = ["mvp-vote.pt-BR.ts", "summary.pt-BR.ts"];
const VOTED_NAME = "Bia";
const SHARE_TEXT = join(__dirname, "..", "model", "summary-share-text.ts");
/** A count of votes or of voters, in any form the app could write it (ADR 0048, item 2). */
const COUNT = /\bvotos\b|votaram|votantes|\d+\s*vot|faltam\s+\d/i;

describe("the secret of the vote on screen 12a", () => {
  test.each([...SCANNED.map((file) => join(STRINGS, file)), SHARE_TEXT])(
    "S1 %s has no count of votes nor of voters",
    (path) => {
      expect(readFileSync(path, "utf8")).not.toMatch(COUNT);
    },
  );

  test("S2 a count the server leaked reaches neither the model nor a text", () => {
    const leaked = { ...ballot(), voters: 97, counts: { "m-bia": 4 } } as MvpBallot;
    const view = mvpVoteView({
      query: { status: "success", data: leaked, error: null },
      members: MEMBERS,
      online: true,
      nowMs: NOW,
      vote: INITIAL_MVP_VOTE,
    });
    const written = JSON.stringify(view);
    expect(written).not.toContain("voters");
    expect(written).not.toContain("counts");
    expect(written).not.toContain("97");
    expect(written).not.toMatch(COUNT);
  });

  test("S3 the ballot is never on disk, and the end of the session clears it", async () => {
    const key = queryKeys.mvpVoting(GROUP, ROUND);
    expect(isPersistedKey(key)).toBe(false);

    const client = createSacouQueryClient();
    client.setQueryData(key, ballot({ myVote: { candidateMemberId: "m-bia", castAt: "x" } }));
    await createCacheSession(client, {
      persistClient: () => Promise.resolve(),
      restoreClient: () => Promise.resolve(undefined),
      removeClient: () => Promise.resolve(),
    }).clearSession();

    expect(client.getQueryData(key)).toBeUndefined();
  });

  test("S5 screen 12: the entry and the shared text never carry the vote, a count or a deadline", () => {
    const voting = { state: "open", opensAt: OPENS_AT, closesAt: CLOSES_AT } as const;
    const view = summaryView({
      query: { status: "success", data: { ...E2_9_ROUND, mvpVoting: voting }, error: null },
      groupName: "Racha",
      members: MEMBERS,
      online: true,
      unsentPoints: 0,
      ballot: ballot({ myVote: { candidateMemberId: "m-bia", castAt: "x" }, canVote: false }),
      nowMs: NOW,
    });
    if (view.kind !== "ready") throw new Error("expected ready");
    expect(view.voting).toEqual({ kind: "voted", text: "Você já votou · resultado em 23 h" });
    expect(JSON.stringify(view.voting)).not.toContain(VOTED_NAME);
    expect(JSON.stringify(view.voting)).not.toContain("m-bia");
    const shared = summaryShareText(view);
    expect(shared).not.toMatch(COUNT);
    expect(shared).not.toMatch(/votou|resultado|fecha em|\d+ h\b/i);
  });
});
