import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { createCacheSession } from "../../../services/query/cache-persister";
import { isPersistedKey } from "../../../services/query/persist-policy";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import type { MvpBallot } from "../../../services/api/sacou-api";
import { GROUP } from "../../groups/model/members.test.fixture";
import { ballot, MEMBERS, NOW, ROUND } from "./model/mvp-ballot.test.fixture";
import { mvpVoteView } from "./model/mvp-vote-view";
import { INITIAL_MVP_VOTE } from "./model/mvp-vote.reducer";

const STRINGS = join(__dirname, "..", "..", "..", "strings");
const SCANNED = ["mvp-vote.pt-BR.ts", "summary.pt-BR.ts"];
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
});
