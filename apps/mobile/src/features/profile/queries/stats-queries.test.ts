import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { MyStats } from "../../../services/api/sacou-api";
import { queryKeys } from "../../../services/query/query-keys";
import { myStatsQuery } from "./stats-queries";

const REPORT: MyStats = {
  year: 2026,
  total: {
    matchesPlayed: 2,
    wins: 1,
    losses: 1,
    plusMinus: 0,
    longestWinStreak: 1,
    mvpCount: 0,
    rounds: 1,
    roundsHeld: 1,
  },
  groups: [],
};

describe("the numbers query", () => {
  test("sits under the key of the own data and is fetched without a year", async () => {
    const fake = createFakeSacouApi();
    fake.respond("getMyStats", apiOk(REPORT));
    const client = new QueryClient();
    await expect(client.query(myStatsQuery(fake.api, true))).resolves.toEqual(REPORT);
    expect(client.getQueryData(queryKeys.myStats())).toEqual(REPORT);
    expect(fake.calls()).toEqual([{ operation: "getMyStats", args: [] }]);
  });

  test("a failure throws, so the query is in error and keeps no data", async () => {
    const fake = createFakeSacouApi();
    fake.respond("getMyStats", apiErr({ kind: "unavailable", retryAfterMs: 0 }));
    const client = new QueryClient();
    await expect(client.query(myStatsQuery(fake.api, true))).rejects.toBeDefined();
    expect(client.getQueryData(queryKeys.myStats())).toBeUndefined();
  });
});
