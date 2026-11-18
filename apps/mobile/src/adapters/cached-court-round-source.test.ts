import { defaultGroupSettings } from "@sacou/match-engine";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import type { Member, Round } from "../services/api/sacou-api";
import { queryKeys } from "../services/query/query-keys";
import { createCachedCourtRoundSource } from "./cached-court-round-source";

const ORIGIN = { groupId: "g-1", roundId: "r-1" };
const GOING = [
  { memberId: "m-2", memberType: "regular", source: "self", position: 2, promoted: false },
  { memberId: "m-1", memberType: "regular", source: "self", position: 1, promoted: true },
] as const;

function roundWith(resolved: unknown): Round {
  return {
    roundId: ORIGIN.roundId,
    seriesId: null,
    localDate: "2026-11-03",
    localTime: "20:30",
    timeZone: "America/Sao_Paulo",
    startsAt: "2026-11-03T23:30:00Z",
    dropInOpensAt: null,
    venue: "Ginásio",
    status: "scheduled",
    settings: { schemaVersion: 1, layer: null, resolved, sources: {} },
    capacity: null,
    goingCount: GOING.length,
    waitlistCount: 0,
    going: [...GOING],
    waitlist: [],
    me: { memberId: "m-1", status: null, position: null, regularPosition: null },
  };
}

const SETTER: Member = {
  memberId: "m-1",
  role: "player",
  memberType: "regular",
  hasAccount: true,
  isMe: false,
  joinedAt: "2026-10-01T00:00:00Z",
  nickname: null,
  primaryPosition: "setter",
  otherPositions: [],
};

describe("the round of the court from the persisted cache (D7)", () => {
  test("the resolved settings, the confirmed and the positions of the cached round", () => {
    const client = new QueryClient();
    const settings = defaultGroupSettings();
    client.setQueryData(queryKeys.round(ORIGIN.groupId, ORIGIN.roundId), roundWith(settings));
    client.setQueryData(queryKeys.members(ORIGIN.groupId), [SETTER]);
    const round = createCachedCourtRoundSource(client).read(ORIGIN);
    expect(round.settings).toEqual(settings);
    expect(round.confirmed.map(({ memberId }) => memberId)).toEqual(["m-2", "m-1"]);
    expect(round.positionOf("m-1")).toBe("setter");
    expect(round.positionOf("m-2")).toBeNull();
  });

  test("a round not on the phone, or that does not parse, has no settings", () => {
    const client = new QueryClient();
    const source = createCachedCourtRoundSource(client);
    expect(source.read(ORIGIN)).toMatchObject({ settings: null, confirmed: [] });
    client.setQueryData(queryKeys.round(ORIGIN.groupId, ORIGIN.roundId), roundWith({ nope: 1 }));
    expect(source.read(ORIGIN).settings).toBeNull();
  });
});
