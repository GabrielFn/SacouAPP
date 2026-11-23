import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { queryKeys } from "./query/query-keys";
import { invalidateSummaryOfRound } from "./summary-invalidation";

describe("invalidateSummaryOfRound (E4.12)", () => {
  test("the server confirmed points: only the summary of that round is read again", async () => {
    const client = new QueryClient();
    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated ?? false;
    const summary = queryKeys.roundSummary("g1", "r1");
    const other = queryKeys.roundSummary("g1", "r2");
    client.setQueryData(summary, { finishedMatches: 1 });
    client.setQueryData(other, { finishedMatches: 1 });
    client.setQueryData(queryKeys.members("g1"), []);
    client.setQueryData(queryKeys.myStats(), { played: 1 });

    invalidateSummaryOfRound(client, { groupId: "g1", roundId: "r1" });
    await Promise.resolve();

    expect(stale(summary)).toBe(true);
    expect(stale(other)).toBe(false);
    expect(stale(queryKeys.myStats())).toBe(true);
    expect(stale(queryKeys.members("g1"))).toBe(false);
  });
});
