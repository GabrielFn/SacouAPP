import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { ROUND_LIST_TRUST_MS } from "../features/court/session/round-end";
import type { RoundSummary } from "../services/api/sacou-api";
import { queryKeys } from "../services/query/query-keys";
import { createCachedRoundEndLookup } from "./cached-round-end-lookup";

const ORIGIN = { groupId: "g1", roundId: "r1" };
const READ_AT = Date.parse("2026-11-20T12:00:00Z");
const OPENED_AT = READ_AT - 1;

const ROUND: RoundSummary = {
  roundId: "r1",
  seriesId: null,
  localDate: "2026-11-19",
  localTime: "17:00",
  startsAt: "2026-11-19T20:00:00.000Z",
  endsAt: "2026-11-19T23:00:00.000Z",
  venue: "Ginásio",
  status: "scheduled",
  capacity: null,
  goingCount: 0,
  waitlistCount: 0,
  me: { status: null, position: null },
};

describe("createCachedRoundEndLookup: the end of a round from the persisted list (R97, D4)", () => {
  test("no list of the group in the cache is unknown", () => {
    const lookup = createCachedRoundEndLookup(new QueryClient());
    expect(lookup.endOf(ORIGIN, OPENED_AT, READ_AT)).toEqual({ kind: "unknown" });
  });

  test("a listed round gives its end", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.rounds("g1"), [ROUND], { updatedAt: READ_AT });
    expect(createCachedRoundEndLookup(client).endOf(ORIGIN, OPENED_AT, READ_AT)).toMatchObject({
      kind: "listed",
      endsAt: Date.parse(ROUND.endsAt),
    });
  });

  test("a missing round is gone only while the list read is under 24 h old", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.rounds("g1"), [], { updatedAt: READ_AT });
    const lookup = createCachedRoundEndLookup(client);
    expect(lookup.endOf(ORIGIN, OPENED_AT, READ_AT + 1)).toEqual({ kind: "gone" });
    expect(lookup.endOf(ORIGIN, OPENED_AT, READ_AT + ROUND_LIST_TRUST_MS)).toEqual({
      kind: "unknown",
    });
  });

  test("a missing round says nothing when the list was read before the session opened", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.rounds("g1"), [], { updatedAt: READ_AT });
    const lookup = createCachedRoundEndLookup(client);
    expect(lookup.endOf(ORIGIN, READ_AT, READ_AT + 1)).toEqual({ kind: "unknown" });
    expect(lookup.endOf(ORIGIN, null, READ_AT + 1)).toEqual({ kind: "unknown" });
  });
});
