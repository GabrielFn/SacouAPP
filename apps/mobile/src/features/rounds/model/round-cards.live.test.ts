import { describe, expect, it } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import {
  liveRoundOf,
  nextRoundOf,
  recentRoundOf,
  roundCardsOf,
  roundsThisWeek,
  SUMMARY_CARD_WINDOW_MS,
  upcomingRoundsOf,
} from "./round-cards";

const START = Date.parse("2026-11-19T20:00:00Z");
const HOUR_MS = 3_600_000;
const AUTO_END_MS = 6 * HOUR_MS;
const END = START + AUTO_END_MS;

function round(extra: Partial<RoundSummary> = {}): RoundSummary {
  return {
    roundId: "r1",
    seriesId: null,
    localDate: "2026-11-19",
    localTime: "17:00",
    startsAt: new Date(START).toISOString(),
    endsAt: new Date(END).toISOString(),
    venue: "Ginásio",
    status: "scheduled",
    capacity: null,
    goingCount: 0,
    waitlistCount: 0,
    me: { status: null, position: null },
    ...extra,
  };
}

/** Which card the round gets at `now`: the three windows never overlap (R97, D3). */
function kindAt(rounds: readonly RoundSummary[], now: number): string {
  if (liveRoundOf(rounds, now) !== null) return "live";
  if (nextRoundOf(rounds, now) !== null) return "next";
  return recentRoundOf(rounds, now) === null ? "none" : "recent";
}

describe("liveRoundOf: the round 'rolando agora' (R97, D3), exact edges", () => {
  const rounds = [round()];

  it("one millisecond before the start is the next round", () => {
    expect(kindAt(rounds, START - 1)).toBe("next");
  });

  it("at the start and until one millisecond before the end it is live", () => {
    expect(kindAt(rounds, START)).toBe("live");
    expect(kindAt(rounds, END - 1)).toBe("live");
  });

  it("at the end it is recent, and 24 h after the end no card is left", () => {
    expect(kindAt(rounds, END)).toBe("recent");
    expect(kindAt(rounds, END + SUMMARY_CARD_WINDOW_MS - 1)).toBe("recent");
    expect(kindAt(rounds, END + SUMMARY_CARD_WINDOW_MS)).toBe("none");
  });

  it("a round closed early (endsAt moved to closedAt) is recent from the closedAt on", () => {
    const closedAt = START + HOUR_MS;
    const closed = [round({ endsAt: new Date(closedAt).toISOString() })];
    expect(kindAt(closed, closedAt - 1)).toBe("live");
    expect(kindAt(closed, closedAt)).toBe("recent");
  });

  it("a canceled round is never live", () => {
    const canceled = [round({ status: "canceled" })];
    for (const now of [START, START + HOUR_MS, END - 1]) {
      expect(liveRoundOf(canceled, now)).toBeNull();
    }
  });

  it("of two rounds being played, the latest start is the live one", () => {
    const earlier = round({ roundId: "early", startsAt: new Date(START - HOUR_MS).toISOString() });
    expect(liveRoundOf([earlier, round()], START + 1)?.roundId).toBe("r1");
  });
});

describe("upcomingRoundsOf: every round of the week (R97 part 2, D6)", () => {
  // Thursday 19/11/2026 at 12:00 local time: the week runs until Monday 23/11 at 00:00.
  const NOW = new Date(2026, 10, 19, 12, 0).getTime();
  const at = (id: string, date: Date, extra: Partial<RoundSummary> = {}) =>
    round({
      roundId: id,
      startsAt: date.toISOString(),
      endsAt: new Date(date.getTime() + HOUR_MS).toISOString(),
      ...extra,
    });

  it("gives two rounds of the same week, the soonest first", () => {
    const rounds = [at("b", new Date(2026, 10, 21, 20)), at("a", new Date(2026, 10, 20, 20))];
    expect(upcomingRoundsOf(rounds, NOW).map((item) => item.roundId)).toEqual(["a", "b"]);
  });

  it("Sunday 23:59 is this week, Monday 00:00 is not", () => {
    const sunday = at("sun", new Date(2026, 10, 22, 23, 59));
    const monday = at("mon", new Date(2026, 10, 23, 0, 0));
    expect(upcomingRoundsOf([sunday, monday], NOW).map((item) => item.roundId)).toEqual(["sun"]);
  });

  it("with none this week, the next round stays so the group still shows up", () => {
    const monday = at("mon", new Date(2026, 10, 23, 0, 0));
    const later = at("later", new Date(2026, 10, 30, 20));
    expect(upcomingRoundsOf([later, monday], NOW).map((item) => item.roundId)).toEqual(["mon"]);
  });

  it("a canceled or a started round is not upcoming", () => {
    const canceled = at("c", new Date(2026, 10, 20, 20), { status: "canceled" });
    const started = at("s", new Date(2026, 10, 19, 10));
    expect(upcomingRoundsOf([canceled, started], NOW)).toEqual([]);
  });

  it("the home count equals the number of week cards, and round is still the next one", () => {
    const list = [at("a", new Date(2026, 10, 20, 20)), at("b", new Date(2026, 10, 21, 20))];
    const group = { groupId: "g", name: "Racha", role: "admin", memberType: "regular" } as const;
    const cards = roundCardsOf([group], [list], NOW);
    expect(cards.groups[0]?.upcoming).toHaveLength(roundsThisWeek([list], NOW));
    expect(cards.groups[0]?.round?.roundId).toBe("a");
    expect(cards.weekText).toBe("2 rodadas nos próximos 7 dias.");
  });
});
