import { describe, expect, it } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import { liveRoundOf, nextRoundOf, recentRoundOf, SUMMARY_CARD_WINDOW_MS } from "./round-cards";

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
