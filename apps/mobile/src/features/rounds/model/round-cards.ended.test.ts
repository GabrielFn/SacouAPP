import { describe, expect, it } from "vitest";

import type { MyGroup, RoundSummary } from "../../../services/api/sacou-api";
import {
  hasEnded,
  nextRoundOf,
  roundCardsOf,
  roundsInWindow,
  upcomingRoundsOf,
  weekSummaryText,
} from "./round-cards";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
// Monday 23 November 2026, 12h05 local: the round below was closed at 12h, long before its 20h start.
const NOW = new Date(2026, 10, 23, 12, 5).getTime();
const GROUP: MyGroup = { groupId: "g1", name: "Racha", role: "admin", memberType: "regular" };

function round(id: string, startsAt: number, endsAt: number, extra: Partial<RoundSummary> = {}) {
  const base: RoundSummary = {
    roundId: id,
    seriesId: null,
    localDate: "2026-11-23",
    localTime: "20:00",
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    venue: "Ginásio",
    status: "scheduled",
    capacity: null,
    goingCount: 0,
    waitlistCount: 0,
    me: { status: null, position: null },
  };
  return { ...base, ...extra };
}

const EVENING = NOW + 8 * HOUR_MS - 5 * MINUTE_MS;
const closedEarly = round("closed", EVENING, NOW - 5 * MINUTE_MS);
const open = round("open", EVENING + 24 * HOUR_MS, EVENING + 30 * HOUR_MS);

describe("an ended round is not upcoming (R99 S1)", () => {
  it("hasEnded: the limit endsAt == now is ended, 1 ms later is not, canceled never", () => {
    expect(hasEnded(round("a", EVENING, NOW), NOW)).toBe(true);
    expect(hasEnded(round("a", EVENING, NOW + 1), NOW)).toBe(false);
    expect(hasEnded(round("a", EVENING, NOW - 1, { status: "canceled" }), NOW)).toBe(false);
  });

  it("nextRoundOf skips a round closed before its start", () => {
    expect(nextRoundOf([closedEarly, open], NOW)?.roundId).toBe("open");
    expect(nextRoundOf([closedEarly], NOW)).toBeNull();
  });

  it("nextRoundOf: endsAt == now is out, 1 ms after is in", () => {
    expect(nextRoundOf([round("x", EVENING, NOW)], NOW)).toBeNull();
    expect(nextRoundOf([round("x", EVENING, NOW + 1)], NOW)?.roundId).toBe("x");
  });

  it("upcomingRoundsOf drops it from the week and from the fallback", () => {
    expect(upcomingRoundsOf([closedEarly, open], NOW).map((item) => item.roundId)).toEqual([
      "open",
    ]);
    expect(upcomingRoundsOf([closedEarly], NOW)).toEqual([]);
  });

  it("roundsInWindow counts 2 of 3 rounds when one was closed early", () => {
    const other = round("other", EVENING + HOUR_MS, EVENING + 2 * HOUR_MS);
    const third = round("third", EVENING + 2 * HOUR_MS, EVENING + 3 * HOUR_MS);
    const count = roundsInWindow([[closedEarly, other], [third]], NOW);
    expect(count).toBe(2);
    expect(weekSummaryText(count)).toBe("2 rodadas nos próximos 7 dias.");
  });

  it("roundCardsOf: the closed round is only the 'recent' card, and the group has no next round", () => {
    const [card] = roundCardsOf([GROUP], [[closedEarly]], NOW).groups;
    expect(card?.upcoming).toEqual([]);
    expect(card?.round).toBeNull();
    expect(card?.hasNextRound).toBe(false);
    expect(card?.recent?.roundId).toBe("closed");
  });
});
