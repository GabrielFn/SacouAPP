import { describe, expect, it } from "vitest";

import type { RoundSummary } from "../../../services/api/sacou-api";
import { recentRoundOf, ROUND_DURATION_MS, SUMMARY_CARD_WINDOW_MS } from "./round-cards";

const START = Date.parse("2026-11-02T20:00:00Z");
const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;

function round(id: string, status: RoundSummary["status"], startsAt = START): RoundSummary {
  return {
    roundId: id,
    seriesId: null,
    localDate: "2026-11-02",
    localTime: "17:00",
    startsAt: new Date(startsAt).toISOString(),
    status,
  } as RoundSummary;
}

describe("recentRoundOf: extra cases (E4.12 part 2, E5)", () => {
  it("a canceled round never shows, at any moment of the window", () => {
    const canceled = [round("c", "canceled")];
    const end = ROUND_DURATION_MS + SUMMARY_CARD_WINDOW_MS;
    for (const offset of [0, 1, ROUND_DURATION_MS, end - 1]) {
      expect(recentRoundOf(canceled, START + offset)).toBeNull();
    }
  });

  it("a canceled round does not hide an older good one", () => {
    const rounds = [round("good", "scheduled", START - 1000), round("c", "canceled")];
    expect(recentRoundOf(rounds, START + 10)?.roundId).toBe("good");
  });

  it("window is start + 6 h + 24 h (known limitation: ignores the endsAt moved by close)", () => {
    expect(SUMMARY_CARD_WINDOW_MS).toBe(DAY_HOURS * HOUR_MS);
    const closed = [round("a", "scheduled")];
    expect(recentRoundOf(closed, START + ROUND_DURATION_MS + SUMMARY_CARD_WINDOW_MS)).toBeNull();
  });

  it("no rounds, no card", () => {
    expect(recentRoundOf([], START)).toBeNull();
  });
});
